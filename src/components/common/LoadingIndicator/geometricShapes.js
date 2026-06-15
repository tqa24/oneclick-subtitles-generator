/**
 * Parametric (trig-loop generated) shape generators for the loading indicator.
 *
 * These build their vertices procedurally from a radius/side/point count rather
 * than from a fixed vertex list. All are pure and take the `RoundedPolygon`
 * class explicitly.
 */

export const createCirclePolygon = (radius, sides, RoundedPolygon) => {
  const vertices = new Float32Array(sides * 2);
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * 2 * Math.PI;
    vertices[i * 2] = Math.cos(angle) * radius;
    vertices[i * 2 + 1] = Math.sin(angle) * radius;
  }
  return new RoundedPolygon(vertices, 3); // 3px rounding for smooth circle
};

export const createStarPolygon = (radius, points, RoundedPolygon) => {
  const vertices = new Float32Array(points * 4);
  const innerRadius = radius * 0.4;
  let vertexIndex = 0;

  for (let i = 0; i < points; i++) {
    const outerAngle = (i / points) * 2 * Math.PI - Math.PI / 2;
    vertices[vertexIndex++] = Math.cos(outerAngle) * radius;
    vertices[vertexIndex++] = Math.sin(outerAngle) * radius;

    const innerAngle = ((i + 0.5) / points) * 2 * Math.PI - Math.PI / 2;
    vertices[vertexIndex++] = Math.cos(innerAngle) * innerRadius;
    vertices[vertexIndex++] = Math.sin(innerAngle) * innerRadius;
  }
  return new RoundedPolygon(vertices, 2); // 2px rounding for smooth star points
};

export const createOvalShape = (width, height, RoundedPolygon) => {
  const sides = 24; // More sides for smoother oval
  const vertices = new Float32Array(sides * 2);
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * 2 * Math.PI;
    vertices[i * 2] = Math.cos(angle) * width;
    vertices[i * 2 + 1] = Math.sin(angle) * height;
  }
  return new RoundedPolygon(vertices, 1); // Less rounding for smoother curves
};

export const createFlowerShape = (size, RoundedPolygon) => {
  // 8-petal flower
  const petals = 8;
  const vertices = new Float32Array(petals * 4);
  let vertexIndex = 0;

  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * 2 * Math.PI;
    const petalTipX = Math.cos(angle) * size;
    const petalTipY = Math.sin(angle) * size;
    const petalBaseX = Math.cos(angle) * size * 0.3;
    const petalBaseY = Math.sin(angle) * size * 0.3;

    vertices[vertexIndex++] = petalTipX;
    vertices[vertexIndex++] = petalTipY;
    vertices[vertexIndex++] = petalBaseX;
    vertices[vertexIndex++] = petalBaseY;
  }
  return new RoundedPolygon(vertices, 6);
};

export const createGearShape = (size, RoundedPolygon) => {
  // Gear with 8 teeth
  const teeth = 8;
  const innerRadius = size * 0.6;
  const outerRadius = size;
  const vertices = new Float32Array(teeth * 4);
  let vertexIndex = 0;

  for (let i = 0; i < teeth; i++) {
    const baseAngle = (i / teeth) * 2 * Math.PI;
    const toothAngle = ((i + 0.5) / teeth) * 2 * Math.PI;

    // Inner point
    vertices[vertexIndex++] = Math.cos(baseAngle) * innerRadius;
    vertices[vertexIndex++] = Math.sin(baseAngle) * innerRadius;

    // Outer tooth point
    vertices[vertexIndex++] = Math.cos(toothAngle) * outerRadius;
    vertices[vertexIndex++] = Math.sin(toothAngle) * outerRadius;
  }
  return new RoundedPolygon(vertices, 2);
};

export const createSunShape = (size, RoundedPolygon) => {
  const rays = 12;
  const innerRadius = size * 0.5;
  const outerRadius = size;
  const vertices = new Float32Array(rays * 4);
  let vertexIndex = 0;

  for (let i = 0; i < rays; i++) {
    const baseAngle = (i / rays) * 2 * Math.PI;
    const rayAngle = ((i + 0.5) / rays) * 2 * Math.PI;

    vertices[vertexIndex++] = Math.cos(baseAngle) * innerRadius;
    vertices[vertexIndex++] = Math.sin(baseAngle) * innerRadius;

    vertices[vertexIndex++] = Math.cos(rayAngle) * outerRadius;
    vertices[vertexIndex++] = Math.sin(rayAngle) * outerRadius;
  }
  return new RoundedPolygon(vertices, 4);
};

export const createRingShape = (size, RoundedPolygon) => {
  const outerSides = 20;
  const innerSides = 16;
  const outerRadius = size;
  const innerRadius = size * 0.4;
  const vertices = new Float32Array((outerSides + innerSides) * 2);
  let vertexIndex = 0;

  // Outer ring - smooth circle
  for (let i = 0; i < outerSides; i++) {
    const angle = (i / outerSides) * 2 * Math.PI;
    vertices[vertexIndex++] = Math.cos(angle) * outerRadius;
    vertices[vertexIndex++] = Math.sin(angle) * outerRadius;
  }

  // Inner ring - smooth circle (reverse direction for proper hole)
  for (let i = innerSides - 1; i >= 0; i--) {
    const angle = (i / innerSides) * 2 * Math.PI;
    vertices[vertexIndex++] = Math.cos(angle) * innerRadius;
    vertices[vertexIndex++] = Math.sin(angle) * innerRadius;
  }

  return new RoundedPolygon(vertices, 2);
};
