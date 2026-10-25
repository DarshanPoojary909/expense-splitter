/**
 * Group Routes (Express Router Layer)
 * 
 * WHY A ROUTES LAYER?
 * - Defines clean, RESTful URL endpoints for group and member management.
 * - Enforces middleware pipelines:
 *     1. `protect`: Authenticates the user via JWT (sets req.user).
 *     2. `requireGroupMember`: Authorizes that req.user is in the embedded `members` array.
 *     3. `requireGroupAdmin`: Authorizes that req.user has admin privileges in the group.
 * - Keeps routing definitions decoupled from business logic and controllers.
 */

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  requireGroupMember,
  requireGroupAdmin,
} from '../middleware/groupAuthMiddleware.js';
import {
  createGroup,
  getMyGroups,
  getGroupById,
  updateGroup,
  getGroupMembers,
  addMember,
  removeMember,
} from '../controllers/groupController.js';

const router = express.Router();

// 1. Group Collection Routes (Authenticated)
router.route('/')
  .post(protect, createGroup)      // POST /api/groups -> Create group
  .get(protect, getMyGroups);       // GET /api/groups -> View my groups

// 2. Individual Group Routes (Authenticated + Group Member Authorization)
router.route('/:id')
  .get(protect, requireGroupMember, getGroupById)                       // GET /api/groups/:id -> Open group
  .put(protect, requireGroupMember, requireGroupAdmin, updateGroup);    // PUT /api/groups/:id -> Update group settings

// 3. Embedded Group Members Routes (Authenticated + Group Authorization)
router.route('/:id/members')
  .get(protect, requireGroupMember, getGroupMembers)                    // GET /api/groups/:id/members -> View members
  .post(protect, requireGroupMember, requireGroupAdmin, addMember);     // POST /api/groups/:id/members -> Add member

router.route('/:id/members/:memberId')
  .delete(protect, requireGroupMember, removeMember);                   // DELETE /api/groups/:id/members/:memberId -> Remove member

export default router;
