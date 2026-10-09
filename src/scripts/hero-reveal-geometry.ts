import { Box3, BufferGeometry, ExtrudeGeometry, Vector3 } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

/** The subset contains only the ampersand outline and original license metadata. */
export function revealGeometry(source:string):BufferGeometry {
  const font=new FontLoader().parse(JSON.parse(source));
  const result=new ExtrudeGeometry(font.generateShapes('&',1),{depth:.25,bevelEnabled:true,bevelThickness:.008,bevelSize:.004,bevelSegments:4,curveSegments:16});
  result.center();result.computeBoundingBox();
  const size=new Box3().copy(result.boundingBox!).getSize(new Vector3());
  const scale=1.85/Math.max(size.x,size.y);
  result.scale(scale,scale,scale);
  return result;
}
