import { Field, ObjectType } from 'type-graphql';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Updoot } from './Updoot';
import { User } from './User';

@ObjectType()
@Entity()
export class Post extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  _id!: number;

  @Field(() => String)
  @Column()
  title?: string;

  @Field(() => String)
  @Column()
  text!: string;

  @Field(() => String)
  @Column({ type: 'int', default: 0 })
  points!: string;

  @Field()
  @Column()
  creatorId: number;

  @Field()
  @ManyToOne(() => User, user => user.posts)
  creator: User;

  @OneToMany(() => Updoot, updoot => updoot.post)
  updoots: Updoot[];

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}
