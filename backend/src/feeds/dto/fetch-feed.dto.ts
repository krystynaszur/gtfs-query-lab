import { IsString, IsNotEmpty } from 'class-validator';

export class FetchFeedDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}
