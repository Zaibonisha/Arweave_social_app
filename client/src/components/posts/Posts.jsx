import React from "react";
import { useQuery } from "@tanstack/react-query";
import Post from "../post/Post";
import { makeRequest } from "../../axios";
import "./posts.scss";

const Posts = ({ userId }) => {
  const { isLoading, error, data } = useQuery({
    queryKey: ["posts", userId],
    queryFn: () =>
      makeRequest.get(`/posts?userId=${userId}`).then((res) => res.data),
  });

  // Filter out duplicate posts by their `id`
  const uniquePosts = data?.filter(
    (post, index, self) => index === self.findIndex((p) => p.id === post.id)
  );

  return (
    <div className="posts">
      {error ? (
        "Something went wrong!"
      ) : isLoading ? (
        "Loading..."
      ) : uniquePosts && uniquePosts.length > 0 ? (
        uniquePosts.map((post) => <Post post={post} key={post.id} />)
      ) : (
        "No posts available"
      )}
    </div>
  );
};

export default Posts;
