import { Field, InputType } from 'type-graphql';
@InputType() // as arguments
export class UserCredentials {
  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  password: string;
}
