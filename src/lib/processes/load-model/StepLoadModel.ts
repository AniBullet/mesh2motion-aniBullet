import { UI } from '../../UI.ts'
import { ModelZipLoader } from './ModelZipLoader.ts'
import { CustomFBXLoader, type FBXResults } from './CustomFBXLoader.ts'
import { Box3 } from 'three/src/math/Box3.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { Scene } from 'three/src/scenes/Scene.js'
import { Mesh } from 'three/src/objects/Mesh.js'
import { MathUtils } from 'three/src/math/MathUtils.js'
import { FrontSide } from 'three/src/constants.js'
import { BufferGeometry, Group, MeshPhongMaterial, Object3DEventMap, type Material, type Object3D, type SkinnedMesh } from 'three'
import { ModalDialog } from '../../ModalDialog.ts'

// Note: EventTarget is a built-ininterface and do not need to import it
export class StepLoadModel extends EventTarget {
  private readonly gltf_loader = new GLTFLoader()
  private readonly custom_fbx_loader: CustomFBXLoader = new CustomFBXLoader()
  private readonly ui: UI = UI.getInstance()
  private original_model_data: Scene | Group = new Scene()
  private final_mesh_data: Scene = new Scene() // mesh data used when creating the skinned mesh

  // model data used for retargeting process. Only used during retargeting processes
  private final_retargetable_model_data: Group<Object3DEventMap> = new Group()
  private debug_model_loading: boolean = false

  private model_display_name: string = 'Imported Model'

  // there can be multiple objects in a model, so store them in a list
  private readonly geometry_list: BufferGeometry[] = []
  private readonly material_list: Material[] = []

  private _added_event_listeners: boolean = false

  // this can happen when images are not loading. this
  // will mess up model and need to just replace the entire material
  private mesh_has_broken_material: boolean = false

  // controls whether to preserve all objects (bones, lights, etc.) or strip to meshes only
  private preserve_skinned_mesh: boolean = false

  // for debugging, let's count these to help us test performance things better
  vertex_count = 0
  triangle_count = 0
  objects_count = 0

  /**
   * Skinned mesh data that will be used for retargeting
   * @returns Loaded Skinned mesh data that will be used for retargeting
   */
  public get_final_retargetable_model_data (): Group<Object3DEventMap> {
    return this.final_retargetable_model_data
  }

  // function that goes through all our geometry data and calculates how many triangles we have
  private calculate_mesh_metrics (buffer_geometry: BufferGeometry[]): void {
    let triangle_count = 0
    let vertex_count = 0

    // calculate all the loaded mesh data
    buffer_geometry.forEach((geometry) => {
      triangle_count += geometry.attributes.position.count / 3
      vertex_count += geometry.attributes.position.count
    })

    this.triangle_count = triangle_count
    this.vertex_count = vertex_count
    this.objects_count = buffer_geometry.length
  }

  private calculate_geometry_and_materials (scene_to_analyze: Scene): void {
    // clear geometry and material list in case we run this again
    // this empties the array in place, and doesn't need to create a new array
    this.geometry_list.length = 0
    this.material_list.length = 0

    scene_to_analyze.traverse((child: Object3D) => {
      if (child.type === 'Mesh') {
        const geometry_to_add: BufferGeometry = this.build_geometry_list_from_mesh(child as Mesh)
        this.geometry_list.push(geometry_to_add)

        // material is broken somehow, so just use a normal material to help communicate this
        if (this.mesh_has_broken_material) {
          const new_material: MeshPhongMaterial = new MeshPhongMaterial()
          new_material.color.set(0x00aaee)
          this.material_list.push(new_material)
          return
        }

        const new_material: Material = (child as Mesh).material.clone()
        this.material_list.push(new_material)
      }
    })
  }

  /**
   * bring in a mesh object, extract geometry data and return only attributes we need
   * Removes Interleaved buffer attributes and converted to normal buffer attributes
   * @param mesh object
   * @returns Geometry data with Buffer Attributes
   */
  private build_geometry_list_from_mesh (child: Mesh): BufferGeometry {
    // handle normal data buffer attribute data structure
    const geometry_to_add: BufferGeometry = child.geometry.clone()
    geometry_to_add.name = child.name

    // the geometry data might be stored as Interleaved buffer,  if it is
    // we need to convert the data to a reular BufferGeometry for processing later
    // this way we can normalize processing later
    if (child.geometry.attributes.position.isInterleavedBufferAttribute) {
      // console.log('reading interleaved geometry for child mesh. Converting', child.geometry)
      geometry_to_add.setAttribute('position', child.geometry.attributes.position.clone())
      geometry_to_add.setAttribute('normal', child.geometry.attributes.normal.clone())
      geometry_to_add.setAttribute('uv', child.geometry.attributes.uv.clone())

      // set uv2 if it exists
      if (child.geometry.attributes.uv2 !== undefined) {
        geometry_to_add.setAttribute('uv2', child.geometry.attributes.uv2.clone())
      }

      // remove skinIndex and skinWeight if they exist
      if (child.geometry.attributes.skinIndex !== undefined) {
        geometry_to_add.deleteAttribute('skinIndex')
      }
      if (child.geometry.attributes.skinWeight !== undefined) {
        geometry_to_add.deleteAttribute('skinWeight')
      }
    }
    return geometry_to_add
  }

  public begin (): void {
    if (this.ui.dom_current_step_index !== null) {
      this.ui.dom_current_step_index.innerHTML = '1'
    }

    if (this.ui.dom_current_step_element !== null) {
      this.ui.dom_current_step_element.innerHTML = 'Load Model'
    }

    if (this.ui.dom_load_model_tools !== null) {
      this.ui.dom_load_model_tools.style.display = 'flex'
    }

    // if we are navigating back to this step, we don't want to add the event listeners again
    if (!this._added_event_listeners) {
      this.add_event_listeners()
      this._added_event_listeners = true
    }
  }

  public add_event_listeners (): void {
    if (this.ui.dom_upload_model_button !== null) {
      this.ui.dom_upload_model_button.addEventListener('change', (event: Event) => {
        const file = event.target.files[0]
        const file_extension: string = this.get_file_extension(file.name)

        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
          console.log('File reader loaded', reader)
          this.load_model_file(reader.result, file_extension)
        }
      })
    }

    if (this.ui.dom_load_model_debug_checkbox !== null) {
      this.ui.dom_load_model_debug_checkbox.addEventListener('change', (event: Event) => {
        const debug_mode = event.target.checked
        this.debug_model_loading = debug_mode
      })
    }

    if (this.ui.dom_load_model_button !== null) {
      this.ui.dom_load_model_button.addEventListener('click', () => {
        // get currently selected option out of the model-selection drop-down
        const model_selection = document.querySelector('#model-selection')

        if (model_selection !== null) {
          const file_name = model_selection.options[model_selection.selectedIndex].value
          const file_extension: string = this.get_file_extension(file_name)
          this.load_model_file(file_name, file_extension)
        }
      })
    }
  }

  private get_file_extension (file_path: string): string {
    const file_name: string | undefined = file_path.split('/').pop() // remove the directory path

    if (file_name === undefined) {
      console.error('Critical Error: Undefined file extension when loading model')
      return 'UNDEFINED'
    }

    const file_extension: string | undefined = file_name?.split('.').pop() // just get last part of the file name

    if (file_extension === undefined) {
      console.error('Critical Error: File does not have a "." symbol in the name')
      return 'UNDEFINED'
    }

    return file_extension
  }

  public clear_loaded_model_data (): void {
    this.original_model_data = new Scene()
    this.final_mesh_data = new Scene()
    this.geometry_list.length = 0
    this.material_list.length = 0
    this.vertex_count = 0
    this.triangle_count = 0
    this.objects_count = 0
    this.mesh_has_broken_material = false
    this.preserve_skinned_mesh = false
  }

  /**
   * 
   * @param preserve 
   */
  public set_preserve_skinned_mesh (preserve: boolean): void {
    this.preserve_skinned_mesh = preserve
  }

  public load_model_file (model_file_path: string | ArrayBuffer | null, file_extension: string): void {
    if (file_extension === 'fbx') {
      this.load_fbx_file(model_file_path)
    } else if (file_extension === 'glb') {
      this.gltf_loader.load(model_file_path as string, (gltf) => {
        const loaded_scene: Scene = gltf.scene
        this.process_loaded_scene(loaded_scene)
      })
    } else if (file_extension === 'zip') {
      console.log('ZIP file can contain GLTF+BIN model data')
      this.handle_zip_file(model_file_path)
    } else {
      console.error('Unsupported file format to load. Only acccepts FBX, (ZIP)GLTF+BIN, GLB:', model_file_path)
    }
  }

  private load_fbx_file (model_file_path: string | ArrayBuffer | null): void {
    if (typeof model_file_path !== 'string') {
      console.warn('something weird happened and FBX is being loaded that is not a filepath for a string:', model_file_path)
      return
    }

    // console.log('Loading FBX model:', model_file_path)
    this.custom_fbx_loader.loadFBX(model_file_path).then((results: FBXResults) => {
      console.log('loaded the FBX file', results)
      this.mesh_has_broken_material = results.is_missing_dependencies
      const loaded_scene: Scene = new Scene()

      // TODO: add the processed, cleaned up data instead of the fbx_scene directly
      loaded_scene.add(results.fbx_scene)

      this.process_loaded_scene(loaded_scene)
    }).catch((error) => {
      console.warn('some type of error', error)
    })
  }

  /**
   * Handles loading a model from a ZIP file with GLTF data
   * supporting both data URLs and ArrayBuffer input.
   */
  private handle_zip_file (model_file_path: string | ArrayBuffer | null): void {
    const zip_loader = new ModelZipLoader()

    // internal async function that loads the ZIP from an ArrayBuffer
    const handle_zip = async (buffer: ArrayBuffer): Promise<void> => {
      try {
        const scene = await zip_loader.loadModelFromZip(buffer)
        console.log('Model loaded from ZIP:', scene)
        this.process_loaded_scene(scene)
      } catch (err) {
        // if no GLTF file found, or other error, show dialog
        console.error('Failed to load model from ZIP:', err)
        new ModalDialog('Failed to load model from ZIP: ', err?.message || err).show()
      }
    }

    // load in the zip and send the array buffer data to the loader
    if (typeof model_file_path === 'string' && model_file_path.startsWith('data:')) {
      fetch(model_file_path)
        .then(async res => await res.arrayBuffer()) // convert to ArrayBuffer for processing
        .then(buffer => handle_zip(buffer).catch((err) => {
          const msg = (err && typeof err === 'object' && 'message' in err) ? err.message : String(err)
          console.error('Failed to load model from ZIP:', err)
          new ModalDialog('Failed to load model from ZIP: ', msg).show()
        }))
        .catch((err) => {
          const msg = (err && typeof err === 'object' && 'message' in err) ? err.message : String(err)
          console.error('Failed to fetch ZIP data:', err)
          new ModalDialog('Failed to fetch ZIP data: ', msg).show()
        })
    } else {
      // ZIP file is corrupted??
      const msg = 'ZIP file data is not in a supported format'
      console.error(msg)
      new ModalDialog('ZIP file error decompressing: ', msg).show()
    }
  }

  private process_loaded_scene (loaded_scene: Scene): void {
    if (this.preserve_skinned_mesh) {
      this.original_model_data = loaded_scene
    } else {
      this.original_model_data = loaded_scene.clone()
      this.original_model_data.name = 'Cloned Scene'
    }

    this.original_model_data.traverse((child) => {
      child.castShadow = true
    })

    // strip out things differently if we need to preserve skinned meshes or regular meshes
    // retargeting mesh could be a Group object, so accept both and share this variable
    let clean_scene_with_only_models: Scene | Group<Object3DEventMap>
    if (this.preserve_skinned_mesh) {
      clean_scene_with_only_models = this.strip_out_retargeting_model_data(this.original_model_data)
    } else {
      clean_scene_with_only_models = this.strip_out_all_unecessary_model_data(this.original_model_data)
    }

    // if there are no valid mesh, or skinned mesh, show error dialog
    if (clean_scene_with_only_models.children.length === 0) {
      if (this.preserve_skinned_mesh) {
        new ModalDialog('Error loading model', 'No SkinnedMesh found in model file for retargeting').show()
      } else {
        new ModalDialog('Error loading model', 'No Mesh found in model file').show()
      }
      return
    }

    // loop through each child in scene and reset rotation
    // if we don't the skinning process doesn't take rotation into account
    // and creates odd results
    clean_scene_with_only_models.traverse((child) => {
      child.rotation.set(0, 0, 0)
      child.scale.set(1, 1, 1)
      child.updateMatrix() // helps re-calculate bounding box for scaling later
      child.updateMatrixWorld() // helps re-calculate bounding box for scaling later
    })

    // Some objects come in very large, which makes it harder to work with
    // scale everything down to a max height. mutate the clean scene object
    this.scale_model_on_import_if_extreme(clean_scene_with_only_models)

    // if we are doing retargeting, our work ends here for loading the model
    // assign the final retargetable model data to the cleaned scene with skinned meshes
    if (this.preserve_skinned_mesh) {
      this.final_retargetable_model_data = clean_scene_with_only_models as Group<Object3DEventMap>
      this.dispatchEvent(new CustomEvent('modelLoadedForRetargeting'))
      return
    }

    // preserved skinned meshes shouldn't be breaking apart mesh data
    // breaking apart skinned meshes converts it to a regular mesh which we don't want.
    this.calculate_geometry_and_materials(clean_scene_with_only_models)
    this.calculate_mesh_metrics(this.geometry_list) // this needs to happen after calculate_geometry_and_materials
    console.log(`Vertex count:${this.vertex_count}    Triangle Count:${this.triangle_count} Object Count:${this.objects_count} `)

    // assign the final cleaned up model to the original model data
    this.final_mesh_data = this.model_meshes()

    console.log('final mesh data should be prepared at this point', this.final_mesh_data)

    this.dispatchEvent(new CustomEvent('modelLoaded'))
  }

  /**
   * We need to keep parents of skinned meshes and bones for retargeting
   * This is because the hierarchy is important for retargeting to work properly
   * @param model_data
   * @returns Group with everything needed for retargeting (SkinnedMesh, Bones, and their parents)
   */
  private strip_out_retargeting_model_data (model_data: Scene | Group): Group<Object3DEventMap> {
    // Create a new Group to hold only the objects we want to keep
    const filtered_group = new Group()
    filtered_group.name = 'Filtered Retargeting Data'

    // Collect objects to keep (SkinnedMesh and Bone objects)
    const objects_to_keep: Object3D[] = []
    model_data.traverse((child) => {
      if (child.type === 'SkinnedMesh' || child.type === 'Bone') {
        objects_to_keep.push(child)
      }
    })

    // Add kept objects to the new group
    objects_to_keep.forEach((obj) => {
      if (obj.parent) {
        // Remove from current parent first
        obj.parent.remove(obj)
      }
      filtered_group.add(obj)
    })

    return filtered_group
  }

  private strip_out_all_unecessary_model_data (model_data: Scene): Scene {
    // create a new scene object, and only include meshes
    const new_scene = new Scene()
    new_scene.name = this.model_display_name

    model_data.traverse((child) => {
      let new_mesh: Mesh

      // if the child is a skinned mesh, create a new mesh object and apply the geometry and material
      if (child.type === 'SkinnedMesh') {
        new_mesh = new Mesh((child as SkinnedMesh).geometry, (child as SkinnedMesh).material)
        new_mesh.name = child.name
        new_scene.add(new_mesh)
      } else if (child.type === 'Mesh') {
        new_mesh = (child as Mesh).clone()
        new_mesh.name = child.name
        new_scene.add(new_mesh)
      }

      // potentially use normal material to help debugging models that look odd
      // some materials have some odd transparency or back-face things that make it look odd
      let material_to_use: MeshPhongMaterial
      if (this.debug_model_loading && new_mesh !== undefined) {
        material_to_use = new MeshPhongMaterial()
        material_to_use.side = FrontSide
        material_to_use.color.set(0x00aaee)
        new_mesh.material = material_to_use
      }
    })

    return new_scene
  }

  private scale_model_on_import_if_extreme (scene_object: Scene | Group<Object3DEventMap>): void {
    let scale_factor: number = 1.0

    // calculate all the meshes to find out the max height
    // some models are more wide like a bird, so don't just use height for this calculation
    const bounding_box = this.calculate_bounding_box(scene_object)
    const height = bounding_box.max.y - bounding_box.min.y
    const width = bounding_box.max.x - bounding_box.min.x
    const depth = bounding_box.max.z - bounding_box.min.z

    const largest_dimension = Math.max(height, width, depth)

    // if model is very large, or very small, scale it to 1.5 to help with application
    if (largest_dimension > 0.5 && largest_dimension < 8) {
      console.log('Model a reasonable size, so no scaling applied: ', bounding_box, ' units is bounding box')
      return
    } else {
      console.log('Model is very large or small, so scaling applied: ', bounding_box, ' units is bounding box')
    }

    scale_factor = 1.5 / height // goal is to scale the model to 1.5 units height (similar to skeleton proportions)

    // scale all the meshes down by the calculated amount
    scene_object.traverse((child) => {
      const child_obj = child as Mesh
      if (child_obj.geometry) { // only scale if child has geometry data
        console.log('Scaling mesh:', child_obj, ' by factor of ', scale_factor)
        child_obj.geometry.scale(scale_factor, scale_factor, scale_factor)
        // Recompute bounds after geometry modification
        child_obj.geometry.computeBoundingBox()
        child_obj.geometry.computeBoundingSphere()
      }
    })
  }

  private calculate_bounding_box (scene_object: Scene | Group<Object3DEventMap>): Box3 {
    let bounding_box: Box3 = new Box3()

    // see if this new object is a larger bounding box than previous
    scene_object.traverse((child: Object3D) => {
      const test_bb = new Box3().setFromObject(child)
      if (test_bb.max.x - test_bb.min.x > bounding_box.max.x - bounding_box.min.x ||
          test_bb.max.y - test_bb.min.y > bounding_box.max.y - bounding_box.min.y ||
          test_bb.max.z - test_bb.min.z > bounding_box.max.z - bounding_box.min.z) {
        bounding_box = test_bb
      }
    })

    return bounding_box
  }

  public model_meshes (): Scene {
    // if the scene has some children in it, that means we already built it
    // this function gets called when we enter the application
    if (this.final_mesh_data.children.length > 0) {
      return this.final_mesh_data
    }

    // create a new scene object, and only include meshes
    const new_scene = new Scene()
    new_scene.name = this.model_display_name

    // do a for loop to add all the meshes to the scene from the geometry and material list
    for (let i = 0; i < this.geometry_list.length; i++) {
      const mesh = new Mesh(this.geometry_list[i], this.material_list[i])
      new_scene.add(mesh)
    }

    this.final_mesh_data = new_scene

    return this.final_mesh_data
  }

  public models_geometry_list (): BufferGeometry[] {
    // loop through final mesh data and return the geometeries
    const geometries_to_return: BufferGeometry[] = []
    this.final_mesh_data.traverse((child) => {
      if (child.type === 'Mesh') {
        geometries_to_return.push((child as Mesh).geometry.clone())
      }
    })

    return geometries_to_return
  }

  public models_material_list (): Material[] {
    return this.material_list
  }

  /**
   * Rotate all geometry data in the model by the given angle (in degrees) around the specified axis.
   * This directly modifies the geometry vertices.
   */
  public rotate_model_geometry (axis: 'x' | 'y' | 'z', angle: number): void {
    const radians = MathUtils.degToRad(angle)
    this.final_mesh_data.traverse((obj: Object3D) => {
      if (obj.type === 'Mesh') {
        const mesh = obj as Mesh
        mesh.geometry.rotateX(axis === 'x' ? radians : 0)
        mesh.geometry.rotateY(axis === 'y' ? radians : 0)
        mesh.geometry.rotateZ(axis === 'z' ? radians : 0)
        mesh.geometry.computeBoundingBox()
        mesh.geometry.computeBoundingSphere()
      }
    })
  }

  public move_model_to_floor (): void {
    // go through all the meshes and find out the lowest point
    // to use later. A model could contain multiple meshes
    // and we want to make sure the offset is the same between all of them
    let final_lowest_point: number = 0
    this.final_mesh_data.traverse((obj: Object3D) => {
      // if object is a mesh, rotate the geometry data
      if (obj.type === 'Mesh') {
        const mesh_obj: Mesh = obj as Mesh
        const bounding_box = new Box3().setFromObject(mesh_obj)

        if (bounding_box.min.y < final_lowest_point) {
          final_lowest_point = bounding_box.min.y
        }
      }
    })

    // move all the meshes to the floor by the amount we calculated above
    this.final_mesh_data.traverse((obj: Object3D) => {
      // if object is a mesh, rotate the geometry data
      if (obj.type === 'Mesh') {
        const mesh_obj: Mesh = obj as Mesh

        // this actually updates the geometry, so the origin will still be at 0,0,0
        // maybe need to recompute the bounding box and sphere internally after translate
        const offset = final_lowest_point * -1
        mesh_obj.geometry.translate(0, offset, 0)
        mesh_obj.geometry.computeBoundingBox()
        mesh_obj.geometry.computeBoundingSphere()
      }
    })
  }
}
