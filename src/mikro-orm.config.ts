import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
import { Post } from "./entities/Post";
import path from "path";

export default {
  migrations: {
    path: path.join(__dirname, "./migrations"),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
  entities: [Post],
  dbName: "regrty",
  user: "postgres",
  password: "pa$$w0rd",
  debug: !__prod__,
  type: "postgresql",
  allowGlobalContext: true,
} as Parameters<typeof MikroORM.init>[0];
// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=239s
