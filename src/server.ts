import 'reflect-metadata';
import { __prod__ } from './constants';
import { MikroORM } from '@mikro-orm/core';
import microConfig from './mikro-orm.config';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { Post } from './entities/Post';

const main = async () => {
  try {
    const orm = await MikroORM.init(microConfig);
    const post1 = orm.em.create(Post, {
      title: 'new post 1',
      createdAt: new Date(),
    });
    const post2 = orm.em.create(Post, {
      title: 'new post 2',
      createdAt: new Date(),
    });
    await orm.em.persistAndFlush(post1);
    await orm.em.persistAndFlush(post2);
    const app = express();

    const apolloServer = new ApolloServer({
      schema: await buildSchema({
        resolvers: [HelloResolver, PostResolver],
        validate: false,
      }),
      context: () => ({ em: orm.em }),
    });
    await apolloServer.start();

    apolloServer.applyMiddleware({ app });

    app.listen(process.env.PORT || 5000, () => {
      console.log(`App is running on port ${process.env.PORT}...`);
    });
  } catch (error) {
    console.log(error);
  }
};

main();
