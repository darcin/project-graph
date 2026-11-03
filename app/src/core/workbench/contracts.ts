import z from "zod";

const uuid = z.string().uuid();
const version = z.number().int().positive();
const timestamp = z.iso.datetime();

export const GraphObjectRefSchema = z
  .string()
  .regex(/^graph:(node|relation|subgraph|pool)\/[0-9a-f-]{36}\?version=[1-9]\d*$/);
export const SourceRecordRefSchema = z.string().regex(/^source:record\/[0-9a-f-]{36}\?generation=[1-9]\d*$/);

export const PoolDepthProfileSchema = z.strictObject({
  contract_constraint: z.number().min(0).max(1),
  definition_stability: z.number().min(0).max(1),
  mutability: z.number().min(0).max(1),
  activation: z.number().min(0).max(1),
  evidence_requirement: z.number().min(0).max(1),
  gate_strength: z.number().min(0).max(1),
  retention: z.number().min(0).max(1),
});

export const PoolDefinitionSchema = z.strictObject({
  pool_id: uuid,
  purpose: z.string().min(1),
  depth_profile: PoolDepthProfileSchema,
  lifecycle_policy: z.enum(["dynamic", "persistent"]),
  read_write_policy: z.enum(["owner_read_write", "owner_read_only"]),
  version,
});

export const ProvenanceSchema = z.strictObject({
  source_record_refs: z.array(SourceRecordRefSchema),
  graph_object_refs: z.array(GraphObjectRefSchema),
  run_id: uuid.optional(),
  derivation_type: z.enum(["user_created", "extracted", "agent_generated"]),
  created_at: timestamp,
});

export const GraphNodeSchema = z.strictObject({
  node_id: uuid,
  kind: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  version,
  provenance: ProvenanceSchema,
});

export const PoolMemberSchema = z
  .strictObject({
    pool_id: uuid,
    member_id: uuid,
    graph_object_ref: GraphObjectRefSchema.optional(),
    source_record_ref: SourceRecordRefSchema.optional(),
    membership_role: z.enum(["member", "anchor", "external_reference"]),
    added_by: uuid,
    added_at: timestamp,
  })
  .refine(
    (member) => Number(member.graph_object_ref !== undefined) + Number(member.source_record_ref !== undefined) === 1,
    {
      message: "PoolMember must reference exactly one graph object or source record",
    },
  );

const position = z.strictObject({ x: z.number(), y: z.number() });
const style = z.strictObject({ opacity: z.number().min(0).max(1), dashed: z.boolean() });
const canvasItemBase = {
  canvas_item_id: uuid,
  position,
  style,
};

export const GraphRefCanvasItemSchema = z.strictObject({
  ...canvasItemBase,
  kind: z.literal("graph_ref"),
  graph_object_ref: GraphObjectRefSchema,
  persistence: z.enum(["session", "saved_view"]),
});

export const CandidateCanvasItemSchema = z.strictObject({
  ...canvasItemBase,
  kind: z.literal("candidate"),
  temporary_payload: z.strictObject({ text: z.string() }),
  persistence: z.literal("session"),
});

export const AnnotationCanvasItemSchema = z.strictObject({
  ...canvasItemBase,
  kind: z.literal("annotation"),
  temporary_payload: z.strictObject({ text: z.string() }),
  persistence: z.enum(["session", "saved_view"]),
});

export const GroupCanvasItemSchema = z.strictObject({
  ...canvasItemBase,
  kind: z.literal("group"),
  member_canvas_item_ids: z.array(uuid),
  persistence: z.enum(["session", "saved_view"]),
});

export const CanvasItemSchema = z.discriminatedUnion("kind", [
  GraphRefCanvasItemSchema,
  CandidateCanvasItemSchema,
  AnnotationCanvasItemSchema,
  GroupCanvasItemSchema,
]);

export const ViewStateSchema = z.strictObject({
  view_id: uuid,
  pool_id: uuid,
  camera: z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() }),
  layout: z.literal("manual"),
  collapse: z.array(uuid),
  filters: z.record(z.string(), z.unknown()),
  canvas_items: z.array(
    z.discriminatedUnion("kind", [GraphRefCanvasItemSchema, CandidateCanvasItemSchema, GroupCanvasItemSchema]),
  ),
  annotations: z.array(AnnotationCanvasItemSchema),
  base_pool_version: version,
});

export const WorkbenchBootstrapSchema = z
  .strictObject({
    schema_version: z.literal("1.0.0"),
    pool: PoolDefinitionSchema,
    nodes: z.array(GraphNodeSchema),
    members: z.array(PoolMemberSchema),
    view: ViewStateSchema,
  })
  .superRefine((bootstrap, context) => {
    const allPoolIdsMatch = [...bootstrap.members, bootstrap.view].every(
      (item) => item.pool_id === bootstrap.pool.pool_id,
    );
    if (!allPoolIdsMatch) {
      context.addIssue({ code: "custom", message: "All members and views must belong to the bootstrap pool" });
    }
    if (bootstrap.view.base_pool_version !== bootstrap.pool.version) {
      context.addIssue({ code: "custom", message: "ViewState base_pool_version must match PoolDefinition version" });
    }
    const nodeRefs = new Set(bootstrap.nodes.map((node) => `graph:node/${node.node_id}?version=${node.version}`));
    for (const member of bootstrap.members) {
      if (member.graph_object_ref?.startsWith("graph:node/") && !nodeRefs.has(member.graph_object_ref)) {
        context.addIssue({ code: "custom", message: `Missing GraphNode for ${member.graph_object_ref}` });
      }
    }
  });

export type PoolDefinition = z.infer<typeof PoolDefinitionSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type ViewState = z.infer<typeof ViewStateSchema>;
export type CanvasItem = z.infer<typeof CanvasItemSchema>;
export type WorkbenchBootstrap = z.infer<typeof WorkbenchBootstrapSchema>;
