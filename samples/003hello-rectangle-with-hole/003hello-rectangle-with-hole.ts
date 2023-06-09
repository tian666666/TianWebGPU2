/*
 * @Description:
 * @Author: tianyw
 * @Date: 2023-04-08 20:03:35
 * @LastEditTime: 2023-04-09 17:04:39
 * @LastEditors: tianyw
 */
export type SampleInit = (params: {
  canvas: HTMLCanvasElement;
}) => void | Promise<void>;

import triangleVertWGSL from "./shaders/rectangle.vert.wgsl?raw";
import redFragWGSL from "./shaders/red.frag.wgsl?raw";
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

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: triangleVertWGSL
      }),
      entryPoint: "main"
    },
    fragment: {
      module: device.createShaderModule({
        code: redFragWGSL
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
      // topology: "triangle-list"
      topology: "triangle-strip"
    }
  });

  function frame() {
    const commandEncoder = device.createCommandEncoder();
    if (!context) return;
    const textureView = context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.draw(19, 1, 0, 0);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};

const canvas = document.getElementById("gpucanvas") as HTMLCanvasElement;
init({ canvas: canvas });
