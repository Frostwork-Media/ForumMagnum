import {
  Components,
  registerComponent,
  withEdit,
} from 'meteor/vulcan:core';
import React, { Component } from 'react';
import { Posts } from '../../lib/collections/posts';
import Users from "meteor/vulcan:users";
import withSetAlignmentPost from "../alignment-forum/withSetAlignmentPost.jsx";
import withUser from '../common/withUser';

class PostsPageAdminActions extends Component {

  handleMoveToMeta = () => {
    const { post, editMutation } = this.props
    editMutation({
      documentId: post._id,
      set: {meta: true, metaDate: new Date()},
      unset: {
        frontpageDate: true,
        curatedDate: true,
      }
    })
  }

  handleMoveToFrontpage = () => {
    const { post, editMutation } = this.props
    editMutation({
      documentId: post._id,
      set: { frontpageDate: new Date() },
      unset: {
        meta: true
      }
    })
  }

  handleMoveToAlignmentForum = () => {
    const { post, setAlignmentPostMutation } = this.props
    setAlignmentPostMutation({
      postId: post._id,
      af: true,
    })
  }

  handleRemoveFromAlignmentForum = () => {
    const { post, setAlignmentPostMutation } = this.props
    setAlignmentPostMutation({
      postId: post._id,
      af: false,
    })
  }

  handleMoveToPersonalBlog = () => {
    const { post, editMutation } = this.props
    editMutation({
      documentId: post._id,
      set: {},
      unset: {
        curatedDate: true,
        frontpageDate: true,
        meta: true
      }
    })
  }

  showAdminActions = () => {
    const { currentUser, post } = this.props
    return Users.canDo(currentUser, "posts.edit.all") || Users.canMakeAlignmentPost(currentUser, post)
  }

  render() {
    const { currentUser, post } = this.props
    if (post) {
      return (
        <div className="posts-page-admin-actions-wrapper">
          { this.showAdminActions() &&
            <div>
              <div className="posts-page-admin-more-options">...</div>
              <div className="posts-page-admin-actions">
                { Users.canDo(currentUser, "posts.edit.all") &&
                  <span>
                    { !post.meta &&
                      <div className="posts-page-admin-action"
                        onClick={this.handleMoveToMeta }>
                        Move to Meta
                      </div>
                    }
                    { !post.frontpageDate &&
                      <div className="posts-page-admin-action"
                        onClick={this.handleMoveToFrontpage }>
                        Move to Frontpage
                      </div>
                    }
                    { (post.frontpageDate || post.meta || post.curatedDate) &&
                       <div className="posts-page-admin-action"
                         onClick={this.handleMoveToPersonalBlog }>
                        Move to Personal Blog
                      </div>
                    }
                  </span>
                }
                { Users.canMakeAlignmentPost(currentUser, post) &&
                  !post.af && <div className="posts-page-admin-action"
                    onClick={this.handleMoveToAlignmentForum }>
                    Ω Make Alignment
                </div>}
                { Users.canMakeAlignmentPost(currentUser, post) && post.af &&
                  <div className="posts-page-admin-action"
                    onClick={this.handleRemoveFromAlignmentForum }>
                    Ω Remove Alignment
                  </div>
                }
                <Components.SuggestCurated post={post} />
              </div>
            </div>
          }
        </div>
      )
    } else {
      return null
    }
  }
}

PostsPageAdminActions.displayName = "PostsPageAdminActions";

const withEditOptions = {
  collection: Posts,
  fragmentName: 'PostsList',
};

const setAlignmentOptions = {
  fragmentName: "PostsList"
}


registerComponent(
  'PostsPageAdminActions',
  PostsPageAdminActions,
  [withEdit, withEditOptions],
  [withSetAlignmentPost, setAlignmentOptions],
  withUser
);
