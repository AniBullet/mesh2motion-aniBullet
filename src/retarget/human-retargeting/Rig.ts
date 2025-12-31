// Setup a standard definition of what a Humanoid is. The rig
// allows to work with different skeletons with various joint
// naming convention. This makes it easier to build a system

import { Pose } from './Pose'
import { RigItem } from './RigItem'
import Vec3 from './Vec3'

import type * as THREE from 'three'

// that speaks a single language of whats what.
export class Rig {
  public readonly skel: THREE.Skeleton
  public readonly tpose: Pose
  public readonly chains: Record<string, RigItem[]> = {}
  public scalar: number = 1

  constructor (skel: THREE.Skeleton) {
    this.skel = skel
    this.tpose = new Pose(skel)
    // this.tpose.debug();
  }

  fromConfig (cfg = {}): this {
    for (const [k, v] of Object.entries(cfg)) {
      switch (k) {
        case 'pelvis' : this.buildItem(k, v.names, new Vec3(0, 0, 1), new Vec3(0, 1, 0)).buildScalar(k); break
        case 'spine' : this.buildItem(k, v.names, new Vec3(0, 1, 0), new Vec3(0, 0, 1)); break
        case 'head' : this.buildItem(k, v.names, new Vec3(0, 0, 1), new Vec3(0, 1, 0)); break

        case 'armL' : this.buildItem(k, v.names, new Vec3(1, 0, 0), new Vec3(0, 0, -1)); break
        case 'armR' : this.buildItem(k, v.names, new Vec3(-1, 0, 0), new Vec3(0, 0, -1)); break

        case 'legL' : this.buildItem(k, v.names, new Vec3(0, 0, 1), new Vec3(0, -1, 0)); break
        case 'legR' : this.buildItem(k, v.names, new Vec3(0, 0, 1), new Vec3(0, -1, 0)); break
      }
    }
    return this
  }

  // k = chain key like 'pelvis', 'armL', etc
  buildItem (k: string, names: string[], swing: Vec3, twist: Vec3): this {
    const ary = []
    let j

    for (const n of names) {
      j = this.tpose.getJoint(n)
      if (j === null) {
        console.log('Error - Rig.buildLimb : Joint name not found in tpose, ', n)
        continue
      }

      ary.push(new RigItem().fromJoint(j, swing, twist))
    }

    this.chains[k] = ary
    return this
  }

  // k = chain key like 'pelvis', 'armL', etc
  buildScalar (k: string): this {
    const ch = this.chains[k]
    const j = this.tpose.joints[ch[0].idx]
    this.scalar = j.world.pos[1]
    return this
  }

  // debugSkelVectors (): void {
  //   // const bAry = this.skel.bones;
  //   const tran = new Transform()
  //   const v = new Vec3()

  //   for (const [chName, ch] of Object.entries(this.chains)) {
  //     for (const itm of ch) {
  //       getWorld(this.skel, itm.idx, tran)
  //       Debug.pnt.add(tran.pos, 0xffff00, 0.8)

  //       v.fromQuat(tran.rot, itm.swing).norm().scale(0.1).add(tran.pos)
  //       Debug.ln.add(tran.pos, v, 0xffff00)

  //       v.fromQuat(tran.rot, itm.twist).norm().scale(0.1).add(tran.pos)
  //       Debug.ln.add(tran.pos, v, 0xff00ff)
  //     }
  //   }
  // }

  // debugTPoseVectors (): void {
  //   // const bAry = this.skel.bones;
  //   const tran: Transform = new Transform()
  //   const v = new Vec3()

  //   for (const [chName, ch] of Object.entries(this.chains)) {
  //     for (const itm of ch) {
  //       this.tpose.getWorld(itm.idx, tran)
  //       // Debug.pnt.add(tran.pos, 0xffff00, 0.8)

  //       v.fromQuat(tran.rot, itm.swing).norm().scale(0.1).add(tran.pos)
  //       // Debug.ln.add(tran.pos, v, 0xffff00)

  //       v.fromQuat(tran.rot, itm.twist).norm().scale(0.1).add(tran.pos)
  //       // Debug.ln.add(tran.pos, v, 0xff00ff)
  //     }
  //   }
  // }
}
