import { foreignKeyField } from '../../utils/schemaUtils'

const schema: SchemaType<DbPostRelation> = {
  type: {
    // "subQuestion"
    type: String,
    optional: true,
    canRead: ['guests'],
    canCreate: ['members'],
    canUpdate: ['members'],
  },
  sourcePostId: {
    ...foreignKeyField({
      idFieldName: "sourcePostId",
      resolverName: "sourcePost",
      collectionName: "Posts",
      type: "Post",
      nullable: true
    }),
    canRead: ['guests'],
    canCreate: ['members'],
  },
  targetPostId: {
    ...foreignKeyField({
      idFieldName: "targetPostId",
      resolverName: "targetPost",
      collectionName: "Posts",
      type: "Post",
      nullable: true
    }),
    canRead: ['guests'],
    canCreate: ['members'],
  },
  order: {
    type: Number,
    optional: true,
    canRead: ['guests'],
    canUpdate: ['admins'],
    canCreate: ['admins'],
  }
};

export default schema;
