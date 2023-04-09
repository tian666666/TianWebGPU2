@vertex
fn main(
    @builtin(vertex_index) VertexIndex: u32
) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 19>(
        vec2(0.0, 0.3),
        vec2(0.0, 0.0),
        vec2(0.1, 0.1),
        vec2(0.1, 0.2),
        vec2(0.0, 0.3), // 第一个梯形结束点 也是第二个梯形起始点
        vec2(0.3, 0.3),
        vec2(0.2, 0.2),
        vec2(0.1, 0.2),
        vec2(0.3, 0.3), // 第二个梯形结束点
        vec2(0.3, 0.3), // 第三个梯形起始点
        vec2(0.3, 0.0),
        vec2(0.2, 0.1),
        vec2(0.2, 0.2),
        vec2(0.3, 0.3),
        vec2(0.3, 0.0), // 第三个梯形结束点  也是第三个梯形起始点
        vec2(0.2, 0.1),
        vec2(0.1, 0.1),
        vec2(0.0, 0.0),
        vec2(0.3, 0.0), // 最后一个梯形
    );

    return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}
