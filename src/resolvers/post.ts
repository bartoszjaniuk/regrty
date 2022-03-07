import { MyContext } from './../types';
import { Ctx, Query, Resolver } from 'type-graphql';
import { Post } from '../entities/Post';

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  posts(@Ctx() ctx: MyContext) {
    return ctx.em.find(Post, {});
  }
}
