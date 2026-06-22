import dotenv from "dotenv";
import fs from "fs";
import neo4j from "neo4j-driver";

dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

async function loadGraph() {
  const session = driver.session();

  try {
    const raw = fs.readFileSync("graph.json", "utf8");

    const clean = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const graph = JSON.parse(clean);

    // Create Nodes
    for (const node of graph.nodes) {
      await session.run(
        `
        MERGE (n:${node.type} {id: $id})
        `,
        {
          id: node.id
        }
      );
    }

    // Create Relationships
    for (const rel of graph.relationships) {
      await session.run(
        `
        MATCH (a {id: $source})
        MATCH (b {id: $target})
        MERGE (a)-[:${rel.type}]->(b)
        `,
        {
          source: rel.source,
          target: rel.target
        }
      );
    }

    console.log("✅ Graph Loaded Successfully!");
  } catch (error) {
    console.error(error);
  } finally {
    await session.close();
    await driver.close();
  }
}

loadGraph();