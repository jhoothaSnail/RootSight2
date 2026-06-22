import dotenv from "dotenv";
import neo4j from "neo4j-driver";

dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

async function test() {
  const session = driver.session();

  try {
    const result = await session.run(
      "RETURN 'Connected!' AS message"
    );

    console.log(result.records[0].get("message"));
  } catch (error) {
    console.error(error);
  } finally {
    await session.close();
    await driver.close();
  }
}

test();