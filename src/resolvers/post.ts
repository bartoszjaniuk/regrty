import { Updoot } from './../entities/Updoot';
import { MyContext } from './../types';
import { isAuth } from '../middlewares/isAuth';
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql';
import { Post } from '../entities/Post';
import { getConnection } from 'typeorm';

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    {
      return root.text.slice(0, 50);
    }
  }

  @Mutation(() => Boolean)
  // @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpvote = value !== -1;
    const realValue = isUpvote ? 1 : -1;
    const { userId } = req.session;

    const upvote = await Updoot.findOne({ where: { postId, userId: userId ? userId : 5 } });

    if (upvote && upvote.value !== realValue) {
      // the user has previously voted this post but user is changing the vote (up to down and viceversa)
      await getConnection().transaction(async transactionalEntityManager => {
        // if one of the database queries fails, the whole transaction rolls back
        await transactionalEntityManager
          .createQueryBuilder()
          .update(Updoot)
          .set({ value: realValue })
          .where('postId = :postId and userId = :userId', { postId, userId: userId ? userId : 5 })
          .execute();

        await transactionalEntityManager
          .createQueryBuilder()
          .update(Post)
          .set({ points: () => `points + ${2 * realValue}` })
          .where('_id = :id', { id: postId })
          .execute();
      });
    } else if (!upvote) {
      // user has never voted this post before
      await getConnection().transaction(async transactionalEntityManager => {
        await transactionalEntityManager
          .createQueryBuilder()
          .insert()
          .into(Updoot)
          .values({ userId: userId ? userId : 5, postId, value: realValue })
          .execute();

        await transactionalEntityManager
          .createQueryBuilder()
          .update(Post)
          .set({ points: () => `points + ${realValue}` })
          .where('_id = :id', { id: postId })
          .execute();
      });
    }

    /* await Upvote.insert({
      userId,
      postId,
      value: realValue,
    }); */

    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    // 20 -> 21
    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;

    const replacements: any[] = [reaLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
    select p.*,
    json_build_object(
      '_id', u._id,
      'username', u.username,
      'email', u.email,
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
      ) creator
    from post p
    inner join public.user u on u._id = p."creatorId"
    ${cursor ? `where p."createdAt" < $2` : ''}
    order by p."createdAt" DESC
    limit $1
    `,
      replacements
    );

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === reaLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }
  // MUTATIONS
  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('postInput') postInput: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({
      ...postInput,
      creatorId: req.session.userId,
    }).save();
  }
  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title', () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    // const post = await Post.findOne({where: {id}})
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    if (typeof title !== 'undefined') {
      await Post.update({ _id: id }, { title });
    }
    return post;
  }
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(@Arg('id', () => Int) id: number): Promise<boolean> {
    try {
      await Post.delete(id);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// https://www.youtube.com/watch?v=I6ypD7qv3Z8&t=239s 1:03
