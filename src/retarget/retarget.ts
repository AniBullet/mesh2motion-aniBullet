import { Mesh2MotionEngine } from '../Mesh2MotionEngine.ts'
import { Group, Object3DEventMap, Skeleton, SkinnedMesh, Vector3 } from 'three'
import { ModalDialog } from '../lib/ModalDialog.ts'

class RetargetModule {
  private mesh2motion_engine: Mesh2MotionEngine
  private fileInput: HTMLInputElement | null = null

  constructor () {
    // Set up camera position similar to marketing bootstrap
    this.mesh2motion_engine = new Mesh2MotionEngine()
    const camera_position = new Vector3().set(0, 1.7, 5)
    this.mesh2motion_engine.set_camera_position(camera_position)
  }

  public add_event_listeners (): void {
    // Get DOM elements
    this.fileInput = document.getElementById('upload-file') as HTMLInputElement

    // Add event listener for file selection
    this.fileInput.addEventListener('change', (event) => {
      console.log('File input changed', event)
      this.handleFileSelect(event)
    })
  }

  private handleFileSelect (event: Event): void {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      const file = target.files[0]
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type)

      // Get file extension
      const file_name = file.name.toLowerCase()
      let file_extension = ''
      if (file_name.endsWith('.glb')) {
        file_extension = 'glb'
      } else if (file_name.endsWith('.fbx')) {
        file_extension = 'fbx'
      } else if (file_name.endsWith('.zip')) {
        file_extension = 'zip'
      } else {
        console.error('Unsupported file type')
        this.showErrorDialog('Unsupported file type. Please select a GLB, FBX, or ZIP file.')
        return
      }

      // Configure the model loader to preserve all objects (bones, etc.)
      this.mesh2motion_engine.load_model_step.set_preserve_skinned_mesh(true)

      // Create a URL for the file and load it
      const file_url = URL.createObjectURL(file)

      try {
        this.mesh2motion_engine.load_model_step.load_model_file(file_url, file_extension)

        this.mesh2motion_engine.load_model_step.addEventListener('modelLoadedForRetargeting', () => {
          console.log('Model loaded for retargeting successfully.')
          URL.revokeObjectURL(file_url) // Revoke the object URL after loading is complete

          // read in mesh2motion engine's retargetable model data
          const retargetable_meshes = this.mesh2motion_engine.load_model_step.get_final_retargetable_model_data()
          const is_valid_skinned_mesh = this.validate_skinned_mesh_has_bones(retargetable_meshes)
          if (is_valid_skinned_mesh) {
            console.log('adding retargetable meshes to scene for retargeting')
            this.reset_skinned_mesh_to_rest_pose(retargetable_meshes)
            this.mesh2motion_engine.get_scene().add(retargetable_meshes)

            // Add skeleton helper
            this.add_skeleton_helper(retargetable_meshes)
          }
        }, { once: true })
      } catch (error) {
        console.error('Error loading model:', error)
        this.showErrorDialog('Error loading model file.')
        URL.revokeObjectURL(file_url) // Clean up the URL
      }
    }
  }

  private showErrorDialog (message: string): void {
    new ModalDialog(message, 'Error').show()
  }

  private reset_skinned_mesh_to_rest_pose (skinned_meshes_group: Group<Object3DEventMap>): void {
    skinned_meshes_group.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        const skinned_mesh = child as SkinnedMesh
        const skeleton: Skeleton = skinned_mesh.skeleton
        skeleton.pose()
        skinned_mesh.updateMatrixWorld(true)
      }
    })
  }

  private validate_skinned_mesh_has_bones (retargetable_model: Group<Object3DEventMap>): boolean {
    // Collect all SkinnedMeshes
    const skinned_meshes: SkinnedMesh[] = []
    retargetable_model.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        const skinned_mesh = child as SkinnedMesh
        skinned_meshes.push(skinned_mesh)
      }
    })

    // Check if we have any SkinnedMeshes
    // TODO: Error can be a dialog box
    if (skinned_meshes.length === 0) {
      new ModalDialog('No SkinnedMeshes found in file', 'Error opening file').show()
      return false
    }

    console.log('skinned meshes found. ready to start retargeting process:', skinned_meshes)
    return true
  }

  private add_skeleton_helper (retargetable_meshes: Group<Object3DEventMap>): void {
    retargetable_meshes.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        const skinned_mesh = child as SkinnedMesh
        this.mesh2motion_engine.regenerate_skeleton_helper(skinned_mesh.skeleton, 'Retarget Skeleton Helper')
      }
    })
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  retarget_app.add_event_listeners()
})

const retarget_app = new RetargetModule()
