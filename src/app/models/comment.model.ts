export interface Comment {
  id?: number;
  text: string;
  userId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: Date;
  videoId?: number;
}

export interface CommentPage {
  content: Comment[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface CommentResponse {
  id: number;
  text: string;
  createdAt: Date;
  videoId: number;
  user: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
  remainingComments: number;
}

export interface RemainingCommentsResponse {
  remainingComments: number;
}
