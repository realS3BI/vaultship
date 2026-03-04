migrate(
  (app) => {
    const collection = new Collection({
      name: "envs",
      type: "base",
      fields: [
        {
          name: "projectId",
          type: "text",
          required: true,
          min: 36,
          max: 36,
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        },
        {
          name: "encryptedEnv",
          type: "text",
          required: true,
          max: 1000000,
        },
        {
          name: "updatedBy",
          type: "text",
          required: false,
          max: 255,
        },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_envs_projectId ON envs (projectId)"],
    });

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("envs");
    return app.delete(collection);
  },
);
