import { MyContext } from 'src/types';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { User } from '../entities/User';
import argon2 from 'argon2';

@InputType() // as arguments
class UserCredentials {
  @Field()
  username: string;

  @Field()
  password: string;
}

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

const createError = (field: string, message: string) => {
  return {
    errors: [{ field, message }],
  };
};

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req, em }: MyContext) {
    if (!req.session.userId) return null;
    const user = await em.findOne(User, { _id: req.session.userId });
    return user;
  }
  @Mutation(() => User)
  async register(
    @Arg('userCredentials') userCredentials: UserCredentials,
    @Ctx() { em, req }: MyContext
  ) {
    const hashedPassword = await argon2.hash(userCredentials.password);

    if (userCredentials.username.length < 4) {
      return createError('username', 'username must contain at leat 4 characters');
    }
    const user = em.create(User, {
      username: userCredentials.username,
      password: hashedPassword,
      createdAt: new Date(),
    });
    try {
      await em.persistAndFlush(user);
    } catch (error) {
      if (error.code === '23505' || error.detail.includes('already exists')) {
        return createError('username', 'username already taken');
      }
    }
    req.session.userId = user._id;
    return user;
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('userCredentials') userCredentials: UserCredentials,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const { username, password } = userCredentials;
    const user = await em.findOne(User, { username });
    if (!user) {
      return createError('username', "User with that login doesn't exist");
    }
    const validatePassword = await argon2.verify(user.password, password);
    if (!validatePassword) {
      createError('username', 'Invalid login or password');
    }
    req.session.userId = user._id;
    return {
      user,
    };
  }
}

// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=239s 1:31:33
