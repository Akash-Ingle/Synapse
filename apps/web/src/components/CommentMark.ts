import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      setComment: (threadId: string) => ReturnType;
      unsetComment: (threadId: string) => ReturnType;
    };
  }
}

const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-thread-id"),
        renderHTML: (attrs) => ({ "data-thread-id": attrs.threadId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-thread-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(HTMLAttributes, {
        class: "comment-highlight",
        style:
          "background-color: rgba(250, 204, 21, 0.3); border-bottom: 2px solid rgb(250, 204, 21); cursor: pointer;",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (threadId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { threadId }),
      unsetComment:
        (threadId: string) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          if (!dispatch) return true;
          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type.name === this.name && mark.attrs.threadId === threadId) {
                tr.removeMark(pos, pos + node.nodeSize, mark);
              }
            });
          });
          dispatch(tr);
          return true;
        },
    };
  },
});

export default CommentMark;
