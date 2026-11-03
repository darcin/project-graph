import type { Project } from "@/core/Project";
import { CollisionBox } from "@/core/stage/stageObject/collisionBox/collisionBox";
import { ExtensionEntity } from "@/core/stage/stageObject/entity/ExtensionEntity";
import { Vector } from "@graphif/data-structures";
import { Rectangle } from "@graphif/shapes";
import type { CanvasItem, ViewState } from "./contracts";

export class WorkbenchCanvasProjection {
  constructor(private readonly project: Project) {}

  load(view: ViewState): ExtensionEntity[] {
    const entities = [...view.canvas_items, ...view.annotations].map((item) => this.toStageObject(item));
    this.project.stage.push(...entities);
    return entities;
  }

  remove(canvasItemId: string): boolean {
    const index = this.project.stage.findIndex((item) => item.uuid === canvasItemId);
    if (index < 0) return false;
    this.project.stage.splice(index, 1);
    return true;
  }

  private toStageObject(item: CanvasItem): ExtensionEntity {
    return new ExtensionEntity(this.project, {
      uuid: item.canvas_item_id,
      extensionId: "attention-workbench",
      typeName: item.kind,
      customData: { canvasItem: item },
      collisionBox: new CollisionBox([
        new Rectangle(new Vector(item.position.x, item.position.y), new Vector(200, 100)),
      ]),
    });
  }
}
