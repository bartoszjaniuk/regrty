import { COOKIE_NAME } from './../constants';
import { MyContext } from 'src/types';
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import argon2 from 'argon2';
import { EntityManager } from '@mikro-orm/postgresql';
import { createError } from '../utils/createValidationError';
import { UserCredentials } from '../models/userCredentials';
import { validateRegister } from '../utils/validateRegister';
import { User } from '../entities/User';

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType() // as responses
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req, em }: MyContext) {
    if (!req.session.userId) return null;
    const user = await em.findOne(User, { _id: req.session.userId });
    return user;
  }

  // @Mutation(() => Boolean)
  // async forgotPassword(@Arg('email') email: string, @Ctx() { em }: MyContext) {
  //   // const user = await em.findOne(User, { email });
  // }

  @Mutation(() => UserResponse)
  async register(
    @Arg('userCredentials') userCredentials: UserCredentials,
    @Ctx() { em, req }: MyContext
  ) {
    const hashedPassword = await argon2.hash(userCredentials.password);

    // const user = em.create(User, {
    //   username: userCredentials.username,
    //   password: hashedPassword,
    //   createdAt: new Date(),
    // });

    const areErrors = validateRegister(userCredentials);

    if (areErrors) return areErrors;

    let user;
    try {
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: userCredentials.username,
          password: hashedPassword,
          created_at: new Date(),
          updated_at: new Date(),
          email: userCredentials.email,
        })
        .returning('*');
      // await em.persistAndFlush(user);
      user = result[0];
    } catch (error) {
      if (error.detail.includes('already exists')) {
        return createError('username', 'username already taken');
      }
    }
    req.session.userId = user._id;
    return {
      user,
    };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,

    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes('@') ? { email: usernameOrEmail } : { username: usernameOrEmail }
    );
    if (!user) {
      return createError('usernameOrEmail', "User with that login or email doesn't exist");
    }
    const isValid = await argon2.verify(user.password, password);
    if (!isValid) {
      return createError('password', 'Invalid login or password');
    }
    req.session.userId = user._id;
    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise(resolve =>
      req.session.destroy(err => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log('Logout error 💣', err);
          resolve(false);
        }
        return resolve(true);
      })
    );
  }
}

// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=239s 1:31:33
