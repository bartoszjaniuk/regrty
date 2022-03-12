import 'reflect-metadata';
import { COOKIE_NAME, __prod__ } from './constants';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from 'cors';
import { UserResolver } from './resolvers/user';
import Redis from 'ioredis';
import { createConnection } from 'typeorm';
import { User } from './entities/User';
import { Post } from './entities/Post';

const main = async () => {
  try {
    createConnection({
      type: 'postgres',
      database: 'regrty2',
      username: 'postgres',
      password: 'pa$$w0rd',
      logging: true,
      synchronize: true,
      entities: [Post, User],
    });

    const app = express();

    app.set('trust proxy', true);
    const whitelist = ['http://localhost:3000'];
    app.use(
      cors({
        origin: function (origin, callback) {
          if (!__prod__) {
            return callback(null, true);
          }

          if (origin && whitelist.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error(`${origin} : Not allowed by CORS`));
          }
        },
        credentials: true,
      })
    );

    const RedisStore = connectRedis(session);
    const redis = new Redis();

    app.use(
      session({
        name: COOKIE_NAME,
        store: new RedisStore({ client: redis, disableTouch: true }),
        saveUninitialized: false,
        secret: 'donkey from shrek',
        resave: false,
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10y
          httpOnly: true,
          // sameSite: __prod__ ? 'lax' : 'none', // csrf, set to none in dev env so cookie can be sent to Apollo Studio
          sameSite: 'lax', // csrf, set to none in dev env so cookie can be sent to Apollo Studio
          secure: false, // cookie only works in https
        },
      })
    );

    const apolloServer = new ApolloServer({
      schema: await buildSchema({
        resolvers: [HelloResolver, PostResolver, UserResolver],
        validate: false,
      }),
      context: ({ req, res }) => ({ req, res, redis }),
    });
    await apolloServer.start();

    apolloServer.applyMiddleware({ app, cors: false });

    app.listen(5000, () => {
      console.log(`App is running on port ${process.env.PORT}...`);
    });
  } catch (error) {
    console.log(error);
  }
};

main();

// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=239s 3:20
