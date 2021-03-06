import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from './../constants';
import { MyContext } from '../types';
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from 'type-graphql';
import argon2 from 'argon2';
import { createError } from '../utils/createValidationError';
import { UserCredentials } from '../models/userCredentials';
import { validateRegister } from '../utils/validateRegister';
import { User } from '../entities/User';
import { sendEmail } from '../utils/sendEmail';
import { v4 } from 'uuid';
import { getConnection } from 'typeorm';

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

@ObjectType() // as responses
class ForgotPasswordResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => Boolean, { nullable: true })
  isCompleted?: boolean;
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    // USER IS CURRENT USER
    if (req.session.userId === user._id) {
      return user.email;
    }
    return '';
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) return null;
    return User.findOne(req.session.userId);
  }

  @Mutation(() => ForgotPasswordResponse)
  async forgotPassword(
    @Arg('email') email: string,
    @Ctx() { redis }: MyContext
  ): Promise<ForgotPasswordResponse> {
    if (email.length < 4) {
      return createError('email', 'email must contain at least 4 characters');
    }

    if (!email.includes('@') || !email.includes('.')) {
      return createError('email', 'Invalid email');
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return createError('user', 'User not found');
    }

    const token = v4();
    const threeDays = 1000 * 60 * 60 * 24 * 3;
    await redis.set(FORGET_PASSWORD_PREFIX + token, user._id, 'ex', threeDays);
    await sendEmail(
      email,
      `<a href='http://localhost:3000/changePassword/${token}'>Reset password</a>`
    );
    return {
      isCompleted: true,
    };
  }

  @Mutation(() => UserResponse)
  async resetPassword(
    @Arg('newPassword') newPassword: string,
    @Arg('token') token: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length < 4) {
      return createError('newPassword', 'password must contain at leat 4 characters');
    }
    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) return createError('token', 'token expired');

    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);

    if (!user) return createError('token', 'user no longer exist');
    await User.update({ _id: userIdNum }, { password: await argon2.hash(newPassword) });
    await redis.del(key);

    req.session.userId = user._id;

    return {
      user,
    };
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('userCredentials') userCredentials: UserCredentials,
    @Ctx() { req }: MyContext
  ) {
    const hashedPassword = await argon2.hash(userCredentials.password);

    const areErrors = validateRegister(userCredentials);

    if (areErrors) return areErrors;

    let user;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: userCredentials.username,
          password: hashedPassword,
          email: userCredentials.email,
        })
        .returning('*')
        .execute();

      user = result.raw[0];

      console.log('user', user);
    } catch (error) {
      if (error.detail.includes('already exists')) {
        console.log(error, 'error');
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

    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes('@')
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
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
          console.log('Logout error ????', err);
          resolve(false);
        }
        return resolve(true);
      })
    );
  }
}

// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=16804s 5:12
