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
  viewsCount?: number;
}

export interface TrendingVideoDTO {
  id: number;
  title: string;
  thumbnailPath?: string;
  viewsCount: number;
  likesCount: number;
  score: number;
  distanceKm?: number;
  popularityScore?: number;
  location?: string;
}