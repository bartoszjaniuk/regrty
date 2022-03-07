import { __prod__ } from './constants';
import { MikroORM } from '@mikro-orm/core';
import path from 'path';
import { Post } from './entities/Post';
import { User } from './entities/User';

export default {
  migrations: {
    path: path.join(__dirname, './migrations'),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
  entities: [Post, User],
  dbName: 'regrty',
  user: 'postgres',
  password: 'pa$$w0rd',
  debug: !__prod__,
  type: 'postgresql',
  allowGlobalContext: true,
} as Parameters<typeof MikroORM.init>[0];
// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=239s
