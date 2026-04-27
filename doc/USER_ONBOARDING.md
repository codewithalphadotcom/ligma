# LIGMA User Onboarding Guide

## What is LIGMA?

LIGMA (Let's Integrate Groups, Manage Anything) is a real-time collaborative canvas application designed for teams to brainstorm, plan, and manage projects visually. It combines an infinite canvas with sticky notes, shapes, freehand drawing, and AI-powered task extraction to create a seamless collaborative experience.

## Current Features (As of April 2026)

Based on the development progress, the following features are currently implemented and ready to use:

### Canvas Functionality
- **Infinite Canvas**: Pan and zoom infinitely across the workspace
- **Sticky Notes**: Create, edit, move, resize, and delete sticky notes with inline text editing
- **Shape Nodes**: Add rectangles, circles, and arrows via the toolbar
- **Freehand Drawing**: Draw strokes with SVG paths
- **Text Blocks**: Add and edit text blocks on the canvas
- **Multi-user Real-time Sync**: Changes sync instantly across all users without page refresh
- **Cursor Presence**: See other users' cursors with labels and colors
- **Node Selection**: Select, multi-select, and delete nodes
- **Time-Travel Replay**: Scrub through the timeline to see how the canvas evolved

### User Interface
- **Node-Level Permissions**: Visual indicators for different access levels (Lead, Contributor, Viewer)
- **Comment Threads**: Comment on locked nodes (for Contributors and Viewers)

## Getting Started

### Prerequisites
- Node.js (latest LTS version)
- PostgreSQL database
- Web browser with modern JavaScript support

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/codewithalphadotcom/ligma.git
   cd ligma
   ```

2. **Install Dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install web app dependencies
   cd apps/web
   npm install
   cd ../..

   # Install server dependencies
   cd apps/server
   npm install
   cd ../..
   ```

3. **Environment Configuration**
   - Copy `.env.example` to `.env` in both `apps/web` and `apps/server`
   - Configure database connection, JWT secrets, and other environment variables

4. **Database Setup**
   - Create a PostgreSQL database
   - Run migrations (when available)

5. **Start the Application**
   ```bash
   # Start the server
   cd apps/server
   npm run dev

   # In another terminal, start the web app
   cd apps/web
   npm run dev
   ```

6. **Access the Application**
   - Open your browser to `http://localhost:3000`
   - Create or join a room to start collaborating

## How to Use LIGMA

### Basic Canvas Navigation
- **Pan**: Click and drag on empty canvas space
- **Zoom**: Use mouse wheel to zoom in/out
- **Zoom to Fit**: Double-click on empty space to fit all content

### Creating Content
- **Sticky Notes**: Double-click on empty canvas to create a sticky note
- **Shapes**: Click toolbar buttons to select shape, then click on canvas to place
- **Drawing**: Select drawing tool and draw with mouse/touch
- **Text Blocks**: Select text tool and click to place text block

### Collaboration
- **Real-time Sync**: All changes appear instantly for all users in the room
- **Cursor Presence**: See where other users are working
- **Comments**: Click on locked nodes to add comments

### Time Travel
- Use the timeline scrubber at the bottom to replay canvas changes
- Step forward/backward through the history of edits

## Upcoming Features

The following features are planned but not yet implemented:
- User authentication and room management
- Task board with AI-extracted action items
- Event log sidebar
- Role-based access control enforcement
- AI intent classification
- Deployment on Render

## Troubleshooting

### Common Issues
- **Canvas not loading**: Check browser console for JavaScript errors
- **Real-time sync not working**: Verify WebSocket connection to server
- **Drawing not smooth**: Ensure hardware acceleration is enabled in browser

### Getting Help
- Check the PLAN.md document for detailed technical specifications
- Review AGENT.md for implementation guidelines
- Open an issue on the GitHub repository for bugs or feature requests

## Contributing

This project is in active development. See PLAN.md for the current development roadmap and team roles.

---

*Last updated: April 27, 2026*</content>
<parameter name="filePath">c:\Users\mhamm\OneDrive\Documents\GitHub\ligma\doc\USER_ONBOARDING.md