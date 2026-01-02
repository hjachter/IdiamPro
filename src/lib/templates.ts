import { v4 as uuidv4 } from 'uuid';
import type { Outline, OutlineNode, NodeMap } from '@/types';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or icon name
  create: () => Outline;
}

// Helper to create a node
function createNode(
  name: string,
  type: 'root' | 'chapter' | 'document' = 'document',
  content: string = '',
  parentId: string | null = null
): OutlineNode {
  return {
    id: uuidv4(),
    name,
    content,
    type,
    parentId,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
  };
}

// Helper to build a tree and return nodes map
function buildTree(root: OutlineNode, children: OutlineNode[][]): NodeMap {
  const nodes: NodeMap = { [root.id]: root };

  const addChildren = (parent: OutlineNode, childList: OutlineNode[]) => {
    childList.forEach(child => {
      child.parentId = parent.id;
      parent.childrenIds.push(child.id);
      nodes[child.id] = child;
    });
  };

  // First level children
  if (children[0]) {
    addChildren(root, children[0]);
  }

  return nodes;
}

// Meeting Notes Template
function createMeetingNotesOutline(): Outline {
  const rootId = uuidv4();
  const nodes: NodeMap = {};

  const root: OutlineNode = {
    id: rootId,
    name: 'Meeting Notes',
    content: '',
    type: 'root',
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
  };
  nodes[root.id] = root;

  const sections = [
    { name: 'Attendees', content: '<p>List meeting attendees here...</p>' },
    { name: 'Agenda', content: '<p>Meeting agenda items...</p>' },
    { name: 'Discussion', content: '<p>Key discussion points...</p>' },
    { name: 'Action Items', content: '<p>• Task 1 - Owner - Due Date</p><p>• Task 2 - Owner - Due Date</p>' },
    { name: 'Next Steps', content: '<p>Follow-up items and next meeting date...</p>' },
  ];

  sections.forEach(({ name, content }) => {
    const node = createNode(name, 'chapter', content, rootId);
    nodes[node.id] = node;
    root.childrenIds.push(node.id);
  });

  return {
    id: uuidv4(),
    name: 'Meeting Notes',
    rootNodeId: rootId,
    nodes,
  };
}

// Project Plan Template
function createProjectPlanOutline(): Outline {
  const rootId = uuidv4();
  const nodes: NodeMap = {};

  const root: OutlineNode = {
    id: rootId,
    name: 'Project Plan',
    content: '',
    type: 'root',
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
  };
  nodes[root.id] = root;

  const sections = [
    { name: 'Overview', content: '<p>Project description and goals...</p>' },
    { name: 'Objectives', content: '<p>• Objective 1</p><p>• Objective 2</p><p>• Objective 3</p>' },
    { name: 'Timeline', content: '<p>Key milestones and deadlines...</p>' },
    { name: 'Resources', content: '<p>Team members, budget, tools...</p>' },
    { name: 'Risks', content: '<p>Potential risks and mitigation strategies...</p>' },
    { name: 'Success Metrics', content: '<p>How we will measure success...</p>' },
  ];

  sections.forEach(({ name, content }) => {
    const node = createNode(name, 'chapter', content, rootId);
    nodes[node.id] = node;
    root.childrenIds.push(node.id);
  });

  return {
    id: uuidv4(),
    name: 'Project Plan',
    rootNodeId: rootId,
    nodes,
  };
}

// Book Outline Template
function createBookOutline(): Outline {
  const rootId = uuidv4();
  const nodes: NodeMap = {};

  const root: OutlineNode = {
    id: rootId,
    name: 'Book Title',
    content: '<p>Your book synopsis here...</p>',
    type: 'root',
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
  };
  nodes[root.id] = root;

  // Create chapters with sub-sections
  const chapters = [
    {
      name: 'Introduction',
      content: '<p>Hook the reader and introduce the main theme...</p>',
      sections: ['Opening Hook', 'Thesis Statement', 'Chapter Overview']
    },
    {
      name: 'Chapter 1',
      content: '<p>First main chapter...</p>',
      sections: ['Key Point 1', 'Key Point 2', 'Summary']
    },
    {
      name: 'Chapter 2',
      content: '<p>Second main chapter...</p>',
      sections: ['Key Point 1', 'Key Point 2', 'Summary']
    },
    {
      name: 'Conclusion',
      content: '<p>Wrap up and call to action...</p>',
      sections: ['Recap', 'Final Thoughts', 'Call to Action']
    },
  ];

  chapters.forEach(({ name, content, sections }) => {
    const chapter = createNode(name, 'chapter', content, rootId);
    nodes[chapter.id] = chapter;
    root.childrenIds.push(chapter.id);

    sections.forEach(sectionName => {
      const section = createNode(sectionName, 'document', '', chapter.id);
      nodes[section.id] = section;
      chapter.childrenIds.push(section.id);
    });
  });

  return {
    id: uuidv4(),
    name: 'Book Title',
    rootNodeId: rootId,
    nodes,
  };
}

// Research Paper Template
function createResearchPaperOutline(): Outline {
  const rootId = uuidv4();
  const nodes: NodeMap = {};

  const root: OutlineNode = {
    id: rootId,
    name: 'Research Paper',
    content: '',
    type: 'root',
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
  };
  nodes[root.id] = root;

  const sections = [
    { name: 'Abstract', content: '<p>Brief summary of the research (150-300 words)...</p>' },
    { name: 'Introduction', content: '<p>Background, problem statement, and research questions...</p>' },
    { name: 'Literature Review', content: '<p>Review of existing research and theoretical framework...</p>' },
    { name: 'Methodology', content: '<p>Research design, data collection, and analysis methods...</p>' },
    { name: 'Results', content: '<p>Findings and data presentation...</p>' },
    { name: 'Discussion', content: '<p>Interpretation of results and implications...</p>' },
    { name: 'Conclusion', content: '<p>Summary, limitations, and future research...</p>' },
    { name: 'References', content: '<p>Bibliography and citations...</p>' },
  ];

  sections.forEach(({ name, content }) => {
    const node = createNode(name, 'chapter', content, rootId);
    nodes[node.id] = node;
    root.childrenIds.push(node.id);
  });

  return {
    id: uuidv4(),
    name: 'Research Paper',
    rootNodeId: rootId,
    nodes,
  };
}

// Weekly Review Template
function createWeeklyReviewOutline(): Outline {
  const rootId = uuidv4();
  const nodes: NodeMap = {};

  const root: OutlineNode = {
    id: rootId,
    name: 'Weekly Review',
    content: '',
    type: 'root',
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
  };
  nodes[root.id] = root;

  const sections = [
    { name: 'Wins This Week', content: '<p>What went well?</p><p>• </p>' },
    { name: 'Challenges', content: '<p>What was difficult?</p><p>• </p>' },
    { name: 'Lessons Learned', content: '<p>What did I learn?</p><p>• </p>' },
    { name: 'Next Week Goals', content: '<p>Top 3 priorities:</p><p>1. </p><p>2. </p><p>3. </p>' },
    { name: 'Notes', content: '<p>Additional thoughts...</p>' },
  ];

  sections.forEach(({ name, content }) => {
    const node = createNode(name, 'chapter', content, rootId);
    nodes[node.id] = node;
    root.childrenIds.push(node.id);
  });

  return {
    id: uuidv4(),
    name: 'Weekly Review',
    rootNodeId: rootId,
    nodes,
  };
}

// Course Notes Template
function createCourseNotesOutline(): Outline {
  const rootId = uuidv4();
  const nodes: NodeMap = {};

  const root: OutlineNode = {
    id: rootId,
    name: 'Course Notes',
    content: '<p>Course name and overview...</p>',
    type: 'root',
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
  };
  nodes[root.id] = root;

  const sections = [
    { name: 'Course Overview', content: '<p>Instructor, schedule, and objectives...</p>' },
    { name: 'Module 1', content: '<p>First module notes...</p>' },
    { name: 'Module 2', content: '<p>Second module notes...</p>' },
    { name: 'Module 3', content: '<p>Third module notes...</p>' },
    { name: 'Key Concepts', content: '<p>Important terms and definitions...</p>' },
    { name: 'Study Guide', content: '<p>Exam prep and review materials...</p>' },
  ];

  sections.forEach(({ name, content }) => {
    const node = createNode(name, 'chapter', content, rootId);
    nodes[node.id] = node;
    root.childrenIds.push(node.id);
  });

  return {
    id: uuidv4(),
    name: 'Course Notes',
    rootNodeId: rootId,
    nodes,
  };
}

// Export all templates
export const templates: Template[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Capture attendees, agenda, and action items',
    icon: '📋',
    create: createMeetingNotesOutline,
  },
  {
    id: 'project-plan',
    name: 'Project Plan',
    description: 'Organize goals, timeline, and resources',
    icon: '📊',
    create: createProjectPlanOutline,
  },
  {
    id: 'book-outline',
    name: 'Book Outline',
    description: 'Structure chapters and sections for writing',
    icon: '📖',
    create: createBookOutline,
  },
  {
    id: 'research-paper',
    name: 'Research Paper',
    description: 'Academic paper with standard sections',
    icon: '🔬',
    create: createResearchPaperOutline,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Reflect on wins, challenges, and goals',
    icon: '📅',
    create: createWeeklyReviewOutline,
  },
  {
    id: 'course-notes',
    name: 'Course Notes',
    description: 'Organize learning by modules and topics',
    icon: '🎓',
    create: createCourseNotesOutline,
  },
];

// Create a blank outline
export function createBlankOutline(name: string = 'Untitled Outline'): Outline {
  const rootId = uuidv4();
  return {
    id: uuidv4(),
    name,
    rootNodeId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        name,
        content: '',
        type: 'root',
        parentId: null,
        childrenIds: [],
        isCollapsed: false,
        prefix: '',
      },
    },
  };
}
