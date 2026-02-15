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
  scheduledTime?: Date;
  isScheduled?: boolean;
  videoDurationSeconds?: number;
}

export interface VideoPlaybackState {
  videoId: number;
  scheduledTime: Date;
  videoDurationSeconds: number;
  currentSecond: number;
  isLive: boolean;
  hasEnded: boolean;
}

export interface VideoAvailability {
  isAvailable: boolean;
  isScheduled: boolean;
  scheduledTime?: Date;
  message?: string;
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