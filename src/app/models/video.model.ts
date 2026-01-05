export interface Video {
  id?: number;
  title: string;
  description: string;
  tags: string[];
  location?: string;
  thumbnailPath?: string;
  videoPath?: string;
  createdAt?: Date;
  userId?: number;
  likesCount?: number;
  likedByCurrentUser?: boolean;
  version?: number;
}