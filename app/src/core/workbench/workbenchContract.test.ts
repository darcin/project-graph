// @vitest-environment jsdom
import type { Project } from "@/core/Project";
import { describe, expect, it, vi } from "vitest";
import { CandidateCanvasItemSchema, WorkbenchBootstrapSchema } from "./contracts";
import m0FixtureJson from "./m0Fixture.json";
import { WorkbenchCanvasProjection } from "./WorkbenchCanvasProjection";

vi.mock("@/core/service/Settings", () => ({ Settings: {} }));

const m0Fixture = WorkbenchBootstrapSchema.parse(m0FixtureJson);

describe("M0 workbench contract", () => {
  it("round-trips one Pool, GraphNode and ViewState payload through the JSON boundary", () => {
    const serialized = JSON.stringify(m0Fixture);
    const received = WorkbenchBootstrapSchema.parse(JSON.parse(serialized));

    expect(received).toEqual(m0Fixture);
    expect(JSON.parse(JSON.stringify(received))).toEqual(JSON.parse(serialized));
  });

  it("projects graph references, candidates and annotations without merging their identities", () => {
    const project = { stage: [] } as unknown as Project;
    const projection = new WorkbenchCanvasProjection(project);

    projection.load(m0Fixture.view);

    expect(project.stage).toHaveLength(3);
    expect(project.stage.map((item) => item.uuid)).toEqual([
      "70000000-0000-4000-8000-000000000001",
      "70000000-0000-4000-8000-000000000002",
      "70000000-0000-4000-8000-000000000003",
    ]);
    expect(m0Fixture.nodes).toHaveLength(1);
    expect(m0Fixture.members).toHaveLength(1);
  });

  it("removes only the canvas projection and preserves graph objects and pool membership", () => {
    const project = { stage: [] } as unknown as Project;
    const projection = new WorkbenchCanvasProjection(project);
    projection.load(m0Fixture.view);
    const nodesBefore = structuredClone(m0Fixture.nodes);
    const membersBefore = structuredClone(m0Fixture.members);

    expect(projection.remove("70000000-0000-4000-8000-000000000001")).toBe(true);

    expect(project.stage).toHaveLength(2);
    expect(m0Fixture.nodes).toEqual(nodesBefore);
    expect(m0Fixture.members).toEqual(membersBefore);
  });

  it("rejects a candidate that pretends to be a persisted graph reference", () => {
    const result = CandidateCanvasItemSchema.safeParse({
      ...m0Fixture.view.canvas_items[1],
      graph_object_ref: "graph:node/20000000-0000-4000-8000-000000000001?version=1",
    });

    expect(result.success).toBe(false);
  });
});
