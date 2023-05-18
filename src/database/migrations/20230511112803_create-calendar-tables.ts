import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    .then(() => {
      return knex.schema
        .hasTable("users")
        .then((exists) => {
          if (!exists) {
            return knex.schema.createTable("users", (table) => {
              table
                .uuid("id")
                .primary()
                .defaultTo(knex.raw("uuid_generate_v4()"));
              table
                .string("username")
                .notNullable()
                .unique()
                .checkLength("<=", 50);

              table.string("email").notNullable().unique();
              table.string("password").notNullable();

              table.string("first_name").notNullable();
              table.string("last_name").notNullable();

              table.boolean("is_email_verified").notNullable().defaultTo(false);

              table.boolean("is_deleted").notNullable().defaultTo(false);
              table.timestamp("deleted_at");

              table.string("calendar_sync_token");
              table.string("stripe_account_id");

              table.timestamp("created_at").defaultTo(knex.fn.now());
            });
          }
          return;
        })
        .then(() => {
          return knex.schema.hasTable("oauth_connections").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("oauth_connections", (table) => {
                // composite primary key - user_id & provider
                table.uuid("user_id");
                table.enu("provider", ["GOOGLE"], {
                  enumName: "provider_type",
                  useNative: true,
                });

                table.string("access_token").notNullable();
                table.string("refresh_token");

                table.timestamp("created_at").defaultTo(knex.fn.now());

                table.primary(["user_id", "provider"]);
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("schedules").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("schedules", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("CASCADE");

                table.string("timezone").notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("schedule_periods").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("schedule_periods", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("schedule_id");
                table
                  .foreign("schedule_id")
                  .references("id")
                  .inTable("schedules")
                  .onDelete("CASCADE");

                table.smallint("day").notNullable().checkBetween([0, 6]);
                table.time("start_time").notNullable();
                table.time("end_time").notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("event_types").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("event_types", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table.uuid("schedule_id");
                table
                  .foreign("schedule_id")
                  .references("id")
                  .inTable("schedules")
                  .onDelete("SET NULL");

                table.string("link").notNullable().checkLength("<=", 50);
                table.string("name").notNullable();
                table.text("description");

                table.integer("duration").unsigned().notNullable();

                table.boolean("is_active").notNullable().defaultTo(true);

                table.boolean("collects_payments").notNullable();
                table.specificType("payment_fee", "money");

                table.enu("location", ["G_MEET", "ADDRESS", "PHONE"], {
                  enumName: "location_type",
                  useNative: true,
                });
                table.string("location_phone_number");
                table.string("location_address");

                table.string("stripe_price_id");
                table.string("stripe_product_id");

                table.timestamp("created_at").defaultTo(knex.fn.now());
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("event_type_questions").then((exists) => {
            if (!exists) {
              return knex.schema.createTable(
                "event_type_questions",
                (table) => {
                  table
                    .uuid("id")
                    .primary()
                    .defaultTo(knex.raw("uuid_generate_v4()"));

                  table.uuid("event_type_id");
                  table
                    .foreign("event_type_id")
                    .references("id")
                    .inTable("event_types")
                    .onDelete("CASCADE");

                  table.enu("type", ["TEXT", "RADIO", "CHECKBOX"], {
                    useNative: true,
                    enumName: "question_type",
                  });

                  table.string("label").notNullable();
                  table.smallint("order").notNullable();
                  table.boolean("is_optional").notNullable();
                }
              );
            }
            return;
          });
        })
        .then(() => {
          return knex.schema
            .hasTable("event_type_question_possible_answers")
            .then((exists) => {
              if (!exists) {
                return knex.schema.createTable(
                  "event_type_question_possible_answers",
                  (table) => {
                    table
                      .uuid("id")
                      .primary()
                      .defaultTo(knex.raw("uuid_generate_v4()"));

                    table.uuid("question_id");
                    table
                      .foreign("question_id")
                      .references("id")
                      .inTable("event_type_questions")
                      .onDelete("CASCADE");

                    table.string("value").notNullable().checkLength("<=", 50);
                  }
                );
              }
              return;
            });
        })
        .then(() => {
          return knex.schema.hasTable("calendar_events").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("calendar_events", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.string("google_id").notNullable();

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table.uuid("event_id").nullable();
                table
                  .foreign("event_id")
                  .references("id")
                  .inTable("events")
                  .onDelete("CASCADE");

                table.datetime("start_date_time").notNullable();
                table.datetime("end_date_time").notNullable();
                table.string("google_link").notNullable();
              });
            }
          });
        })
        .then(() => {
          return knex.schema.hasTable("payments").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("payments", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table
                  .enu("status", ["WAITING", "SUCCESS", "FAIL"], {
                    useNative: true,
                    enumName: "payment_status_type",
                  })
                  .defaultTo("WAITING");
                table.jsonb("processor_payload");
                table.specificType("total_fee", "money").notNullable();
                table.specificType("application_fee", "money").notNullable();
                table.timestamps(true, true);
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("events").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("events", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table.uuid("event_type_id");
                table
                  .foreign("event_type_id")
                  .references("id")
                  .inTable("event_types")
                  .onDelete("RESTRICT");

                table.uuid("payment_id").nullable();
                table
                  .foreign("payment_id")
                  .references("id")
                  .inTable("payments")
                  .onDelete("RESTRICT");

                table.enu(
                  "status",
                  ["PENDING_PAYMENT", "ACTIVE", "CANCELLED", "FAILED_PAYMENT"],
                  { enumName: "event_status_type", useNative: true }
                );

                table.string("user_email").notNullable();
                table.string("invitee_email").notNullable();
                table.string("invitee_full_name").notNullable();

                table.string("google_meets_link");

                table.timestamp("created_at").defaultTo(knex.fn.now());
                table.timestamp("cancelled_at");
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("event_answers").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("event_answers", (table) => {
                table.uuid("event_id");
                table.uuid("question_id");
                table.text("value").notNullable();

                table.primary(["event_id", "question_id"]);
              });
            }
            return;
          });
        });
    });
}

export async function down(knex: Knex): Promise<void> {
  const types = [
    "provider_type",
    "location_type",
    "question_type",
    "payment_status_type",
    "event_status_type",
  ];
  const tables = [
    "users",
    "oauth_connections",
    "schedules",
    "schedule_periods",
    "event_types",
    "event_type_questions",
    "event_type_question_possible_answers",
    "events",
    "event_answers",
    "calendar_events",
    "payments",
  ];

  return Promise.all(
    types.map((type) => knex.raw(`DROP TYPE IF EXISTS ${type} CASCADE;`))
  )
    .then(() => {
      return Promise.all(
        tables.map((table) =>
          knex.raw(`DROP TABLE IF EXISTS ${table} CASCADE;`)
        )
      );
    })
    .then(() => {
      return;
    });
}
