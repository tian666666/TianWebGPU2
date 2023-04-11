/*
 * @Description:
 * @Author: tianyw
 * @Date: 2023-04-08 20:03:35
 * @LastEditTime: 2023-04-11 22:07:04
 * @LastEditors: tianyw
 */
import { mat4, vec3 } from "gl-matrix";
import {
  cubeVertexArray,
  cubeVertexSize,
  cubeUVOffset,
  cubePositionOffset,
  cubeVertexCount
} from "./utils/cube";
export type SampleInit = (params: {
  canvas: HTMLCanvasElement;
}) => void | Promise<void>;

import basicVertWGSL from "./shaders/basic.vert.wgsl?raw";
import vertexPositionColorWGSL from "./shaders/vertexPositionColor.frag.wgsl?raw";
const init: SampleInit = async ({ canvas }) => {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return;
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");
  if (!context) return;
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: "premultiplied"
  });
  console.log("bytelength等于：4 * 10 * 6 * 6=", cubeVertexArray.byteLength);
  // Create a vertex buffer from the cube data.
  // 1、创建 VBO
  // 获取一块状态为映射了的显存，以及一个对应的 arrayBuffer 对象来写数据
  // 建立顶点缓冲区
  // 它就是一块存储空间，先让 js 把顶点数据放进去，然后再让着色器从里面读取
  // 至于为什么 js 不通过一个简单的方法直接把顶点数据传递给着色器，这是因为 js 和 着色器用的是两种不一样的语言
  // 它们无法直接对话，因此需要一个缓冲地带，也就是缓冲区对象
  const verticesBuffer = device.createBuffer({
    size: cubeVertexArray.byteLength, // 指定了需要申请多大的显存，单位是 byte
    usage: GPUBufferUsage.VERTEX, // 表示与顶点相关的变量
    mappedAtCreation: true // 被设置为 true，则 size 必须是 4 的倍数，创建时立刻映射，让 CPU 端能读写数据
  });
  // 2、复制目标/复制源类型的 GPUBuffer
  const arrayBuffer = verticesBuffer.getMappedRange();
  // 通过 TypedArray 向 ArrayBuffer 写入数据（从 CPU 到 GPU）
  // 将顶点数据写入到上面建立的缓冲区对象
  new Float32Array(arrayBuffer).set(cubeVertexArray);
  // 解除显存对象的映射，稍后它就能在 GPU 中进行复制操作
  verticesBuffer.unmap();
  // 管线组装
  const pipeline = device.createRenderPipeline({
    layout: "auto", // 渲染管线的布局
    vertex: {
      module: device.createShaderModule({
        code: basicVertWGSL
      }),
      entryPoint: "main",
      buffers: [ // 这里的 buffers 属性就是缓冲区集合，其中一个元素对应一个缓冲对象
        {
          arrayStride: cubeVertexSize, // 顶点长度 以字节为单位
          attributes: [
            {
              // position
              shaderLocation: 0, // 遍历索引，这里的索引值就对应的是着色器语言中 @location(0) 的数字
              offset: cubePositionOffset, // 偏移
              format: "float32x4" // 参数格式
            },
            {
              // uv
              shaderLocation: 1, // 这里的索引值就对应的是着色器语言中 @location(1) 的数字
              offset: cubeUVOffset,
              format: "float32x2"
            }
          ]
        }
      ]
    },
    fragment: {
      module: device.createShaderModule({
        code: vertexPositionColorWGSL
      }),
      entryPoint: "main",
      targets: [
        {
          format: presentationFormat
        }
      ]
    },
    primitive: {
      // topology: "line-list"
      // topology: "line-strip"
      //  topology: "point-list"
      topology: "triangle-list",
      // topology: "triangle-strip"
      // Backface culling since the cube is solid piece of geometry.
      // Faces pointing away from the camera will be occluded by faces
      // pointing toward the camera.
      // 相关定义为：
      //   enum GPUFrontFace {
      //     "ccw",
      //     "cw"
      // };
      // enum GPUCullMode {
      //     "none",
      //     "front",
      //     "back"
      // };
      // ...

      // dictionary GPURasterizationStateDescriptor {
      //     GPUFrontFace frontFace = "ccw";
      //     GPUCullMode cullMode = "none";
      //     ...
      // };
      // 开启面剔除
      //       其中ccw表示逆时针，cw表示顺时针；frontFace用来设置哪个方向是“front”（正面）；cullMode用来设置将哪一面剔除掉。

      // 因为本示例没有设置frontFace，因此frontFace为默认的ccw，即将顶点连接的逆时针方向设置为正面；
      // 又因为本示例设置了cullMode为back，那么反面的顶点（即顺时针连接的顶点）会被剔除掉。
      cullMode: "back"
    },
    // Enable depth testing so that the fragment closest to the camera
    // is rendered in front.
    depthStencil: {
      // 开启深度测试
      depthWriteEnabled: true,
      // 设置比较函数为 less
      depthCompare: "less",
      // 设置depth为24bit
      format: "depth24plus"
    }
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });

  const uniformBufferSize = 4 * 16; // 4x4 matrix
  // 创建 UBO        GPU
  // COPY_DST 通常就意味着有数据会复制到此 GPUBuffer 上，这种 GPUBuffer 可以通过 queue.writeBuffer 方法写入数据
  // 片元着色器传递数据：如 const color = new Float32Array([1, 0, 0, 1]) 表示一个颜色
  // 为颜色 创建缓冲区对象，设置其尺寸和用途，使其作用于片元着色器，并可写
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  // 通过打组，可以很方便地将某种条件下的一组 uniform 资源分别传入着色器进行 WebGPU 渲染编程。
  // GPUBindGroup 的最大作用，就是隔离不相关的 uniform，把相关的资源摆在一块。
  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0), // 指定绑定组的布局对象，渲染管线的布局
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer // 传入 UBO
        }
      }
    ]
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // Assigned later

        clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
        // loadOp和storeOp决定渲染前和渲染后怎样处理attachment中的数据。
        loadOp: "clear", // load 的意思是渲染前保留attachment中的数据,clear 意思是渲染前清除
        storeOp: "store" // 如果为“store”，意思是渲染后保存被渲染的内容到内存中，后面可以被读取；如果为“clear”，意思是渲染后清空内容。
      }
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      // 在深度测试时，gpu会将fragment的z值（范围为[0.0-1.0]）与这里设置的depthClearValue值（这里为1.0）比较。其中使用depthCompare定义的函数（这里为less，意思是所有z值大于等于1.0的fragment会被剔除）进行比较。
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store"
    }
  };
  // 因为是固定相机 所以只需要计算一次 projection 矩阵
  const aspect = canvas.width / canvas.height;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);

  // 计算 mvp 矩阵
  function getTransformationMatrix() {
    const viewMatrix = mat4.create();
    mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -4));
    const now = Date.now() / 1000;
    mat4.rotate(
      viewMatrix,
      viewMatrix,
      1,
      vec3.fromValues(Math.sin(now), Math.cos(now), 0)
    );

    const modelViewProjectionMatrix = mat4.create();
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

    return modelViewProjectionMatrix as Float32Array;
  }

  function frame() {
    if (!context) return;
    const transformationMatrix = getTransformationMatrix();
    // 写入：从 CPU 到  GPU
    // 将颜色数据/旋转数据 写入到缓冲区对象
    device.queue.writeBuffer(
      uniformBuffer, // 传给谁
      0,
      transformationMatrix.buffer, // 传递 ArrayBuffer
      transformationMatrix.byteOffset, // 从哪里开始
      transformationMatrix.byteLength // 取多长
    );
    renderPassDescriptor.colorAttachments[0].view = context
      .getCurrentTexture()
      .createView();
    // 创建一个i名为 commandEncoder 的指令编码器，用来复制显存
    // 我们不能直接操作command buffer，需要创建command encoder，使用它将多个commands（如render pass的draw）设置到一个command buffer中，然后执行submit，把command buffer提交到gpu driver的队列中。
    //     command buffer有
    // creation, recording,ready,executing,done五种状态。

    // 根据该文档，结合代码来分析command buffer的操作流程：
    // const commandEncoder = device.createCommandEncoder()这个语句：创建command encoder时，应该是创建了command buffer，它的状态为creation；
    // const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)这个语句：开始render pass（webgpu还支持compute pass，不过这里没用到），command buffer的状态变为recording；
    // passEncoder.setPipeline(pipeline) 这个语句：将“设置pipeline”、“绘制”的commands设置到command buffer中；
    // passEncoder.end() 这个语句：(可以设置下一个pass，如compute pass，不过这里只用了一个pass）；
    // commandEncoder.finish() 这个语句：将command buffer的状态变为ready；
    // device.queue.submit 这个语句：command buffer状态变为executing，被提交到gpu driver的队列中，不能再在cpu端被操作；
    // 如果提交成功，gpu会决定在某个时间处理它。
    const commandEncoder = device.createCommandEncoder();
    // 建立渲染通道，类似图层
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    // 传入渲染管线
    passEncoder.setPipeline(pipeline);
    // draw 之前设置 bind group
    passEncoder.setBindGroup(0, uniformBindGroup);
    // VBO 要通过 passEncoder 的 setVertexBuffer 方法写入数据
    // 有时还要配合 GPUBufferUsage.INDEX 即 索引缓存 来使用
    // 通道编码器中指定坐标缓存、颜色缓存
    // 写入顶点缓冲区
    passEncoder.setVertexBuffer(0, verticesBuffer);
    // 绘图：指定绘制的顶点个数
    passEncoder.draw(cubeVertexCount, 1, 0, 0);
    passEncoder.end();
    // 提交写好的复制功能的命令
    // commandEncoder.finish(): 结束指令编写，并返回 GPU 指令缓冲区
    // device.queue.submit：向 GPU 提交绘图指令，所有指令将在提交后执行
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};

const canvas = document.getElementById("gpucanvas") as HTMLCanvasElement;
init({ canvas: canvas });
