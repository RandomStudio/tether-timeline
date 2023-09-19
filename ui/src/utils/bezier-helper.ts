/**
 *  Approaches here taken from https://stackoverflow.com/questions/7348009/y-coordinate-for-a-given-x-cubic-bezier
 */

// export const solveQuadraticEquation = (a: number, b: number, c: number): number[] => {
//   const discriminant = b * b - 4 * a * c;

//   if (discriminant < 0) {
//       return [];
//   }

//   return [
//       (-b + Math.sqrt(discriminant)) / (2 * a),
//       (-b - Math.sqrt(discriminant)) / (2 * a)
//   ];
// }

// export const solveCubicEquation = (a: number, b: number, c: number, d: number): number[] => {

//   if (!a) return solveQuadraticEquation(b, c, d);

//   b /= a;
//   c /= a;
//   d /= a;

//   const p = (3 * c - b * b) / 3;
//   const q = (2 * b * b * b - 9 * b * c + 27 * d) / 27;

//   if (p === 0) {
//     return [ Math.pow(-q, 1 / 3) ];
//   }

//   if (q === 0) {
//     return [Math.sqrt(-p), -Math.sqrt(-p)];
//   }

//   const discriminant = Math.pow(q / 2, 2) + Math.pow(p / 3, 3);
//   if (discriminant === 0) {
//     return [Math.pow(q / 2, 1 / 3) - b / 3];
//   }

//   if (discriminant > 0) {
//     return [Math.pow(-(q / 2) + Math.sqrt(discriminant), 1 / 3) - Math.pow((q / 2) + Math.sqrt(discriminant), 1 / 3) - b / 3];
//   }

//   const r = Math.sqrt( Math.pow(-(p/3), 3) );
//   const phi = Math.acos(-(q / (2 * Math.sqrt(Math.pow(-(p / 3), 3)))));
//   const s = 2 * Math.pow(r, 1/3);
//   return [
//     s * Math.cos(phi / 3) - b / 3,
//     s * Math.cos((phi + 2 * Math.PI) / 3) - b / 3,
//     s * Math.cos((phi + 4 * Math.PI) / 3) - b / 3
//   ];
// }

// export const roundToDecimal = (num: number, dec: number): number => (
//   Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec)
// )

// export const solveCubicBezier = (p0: number, p1: number, p2: number, p3: number, x: number): number[] => {

//   p0 -= x;
//   p1 -= x;
//   p2 -= x;
//   p3 -= x;

//   const roots = solveCubicEquation(
//       p3 - 3 * p2 + 3 * p1 - p0,
//       3 * p2 - 6 * p1 + 3 * p0,
//       3 * p1 - 3 * p0,
//       p0
//   );

//   const result = [];
//   let root;
//   for (let i = 0; i < roots.length; i++) {
//       root = roundToDecimal(roots[i], 15);
//       if (root >= 0 && root <= 1) result.push(root);
//   }

//   return result;
// }

export type BezierPoint = {
  x: number
  y:  number
}

export const curve = (a: number, b: number, c: number, d: number, t: number) => (
  Math.pow(1 - t, 3) * a +
    3 * Math.pow(1 - t, 2) * t * b +
    3 * (1 - t) * Math.pow(t, 2) * c +
    Math.pow(t, 3) * d
)

export const cubicBezier = (p1: BezierPoint, c1: BezierPoint, c2: BezierPoint, p2: BezierPoint, t: number) => ({
  x: curve(p1.x, c1.x, c2.x, p2.x, t),
  y: curve(p1.y, c1.y, c2.y, p2.y, t),
})

export const findTForX = (p1: number, c1: number, c2: number, p2: number, targetX: number, precision: number = 0.0001): number => {
  const b = (t: number) => curve(p1, c1, c2, p2, t)
  let lower = 0, upper = 1
  let mid = lower + 0.5 * (upper - lower)
  let x = b(mid)
  while (Math.abs(targetX - x) > precision) {
    if (targetX > x) {
      lower = mid
    } else {
      upper = mid
    }
    mid = lower + 0.5 * (upper - lower)
    x = b(mid)
  }
  return mid
  // const results = solveCubicBezier(p1.x, c1.x, c2.x, p2.x, targetX);
  // if (results.length) return results[0]
  // return (targetX - p1.x) / (p2.x - p1.x)
}
