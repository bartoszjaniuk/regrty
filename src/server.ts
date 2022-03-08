import { UserResolver } from './resolvers/user';
import 'reflect-metadata';
import { __prod__ } from './constants';
import { MikroORM } from '@mikro-orm/core';
import microConfig from './mikro-orm.config';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
// import { Post } from './entities/Post';
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from 'cors';

const main = async () => {
  try {
    const orm = await MikroORM.init(microConfig);

    const app = express();

    app.use(
      cors({
        credentials: true,
        origin: 'https://studio.apollographql.com',
      })
    );
    // app.use(cors(corsOptions));

    const RedisStore = connectRedis(session);

    const { createClient } = require('redis');

    const redisClient = createClient({ legacyMode: true });
    redisClient.connect().catch(console.error);

    app.use(
      session({
        name: 'qid',
        store: new RedisStore({ client: redisClient, disableTouch: true }),
        saveUninitialized: false,
        secret: 'donkey from shrek',
        resave: false,
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10y
          httpOnly: true,
          // secure: __prod__, //cookie only works in https
          secure: true,
          sameSite: 'none',
        },
      })
    );

    app.set('trust proxy', true);

    const apolloServer = new ApolloServer({
      schema: await buildSchema({
        resolvers: [HelloResolver, PostResolver, UserResolver],
        validate: false,
      }),
      context: ({ req, res }) => ({ em: orm.em, req, res }),
    });
    await apolloServer.start();

    apolloServer.applyMiddleware({ app, cors: false });

    app.listen(process.env.PORT || 5000, () => {
      console.log(`App is running on port ${process.env.PORT}...`);
    });
  } catch (error) {
    console.log(error);
  }
};

main();

// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=239s 1.58
