import { Vector3, type Bone } from 'three'

/*
 * IndependentBoneMovement
 * Encapsulates the "Move Bone Independently" feature for the Edit Skeleton step.
 *
 * When enabled, moving a bone will not drag its children along with it.  Instead,
 * each direct bone-child's world position is snapshotted at the start of a drag,
 * and then re-expressed in the (moving) parent's local frame every frame so that
 * the children appear stationary in world space.
 *
 * If mirror mode is also active the same behaviour is applied to the mirror bone's
 * children so that both sides of the skeleton stay in sync.
 */
export class IndependentBoneMovement {
  private _enabled: boolean = false
  private readonly _children_initial_world_positions: Map<string, Vector3> = new Map()

  public is_enabled (): boolean {
    return this._enabled
  }

  public set_enabled (value: boolean): void {
    this._enabled = value
  }

  /**
   * Snapshot the world positions of the direct bone children at drag start.
   * Clears any previously stored positions first.
   * When mirror mode is also active, pass the mirror bone as the second argument
   * so its children are tracked in the same pass.
   */
  public record_drag_start (bone: Bone, mirror_bone?: Bone): void {
    this._children_initial_world_positions.clear()
    this._append_children_world_positions(bone)
    if (mirror_bone !== undefined) {
      this._append_children_world_positions(mirror_bone)
    }
  }

  /**
   * Re-pin the direct children of a bone to their snapshotted world positions.
   * Call this every frame while the bone is being dragged.
   * When mirror mode is also active, pass the mirror bone as the second argument
   * so its children are pinned in the same call.
   */
  public apply (bone: Bone, mirror_bone?: Bone): void {
    this._apply_to_bone(bone)
    if (mirror_bone !== undefined) {
      this._apply_to_bone(mirror_bone)
    }
  }

  private _append_children_world_positions (bone: Bone): void {
    bone.children.forEach((child) => {
      if ('isBone' in child && child.isBone) {
        const world_pos = new Vector3()
        child.getWorldPosition(world_pos)
        this._children_initial_world_positions.set(child.uuid, world_pos.clone())
      }
    })
  }

  private _apply_to_bone (bone: Bone): void {
    bone.children.forEach((child) => {
      if (!('isBone' in child) || !child.isBone) { return }
      const initial_world_pos = this._children_initial_world_positions.get(child.uuid)
      if (initial_world_pos === undefined) { return }
      const local_pos = initial_world_pos.clone()
      bone.worldToLocal(local_pos)
      child.position.copy(local_pos)
      // updateWorldMatrix(updateParents, updateChildren) - propagate changes up and down the hierarchy
      child.updateWorldMatrix(true, true)
    })
  }
}
