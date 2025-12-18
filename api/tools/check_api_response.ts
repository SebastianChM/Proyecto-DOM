import axios from "axios";

async function checkApiResponse() {
  const projectId = "7f5fc7e2-c454-416e-9fc7-d07220f40100";
  const url = `http://localhost:8080/api/projects/${projectId}`;

  console.log(`Fetching project from ${url}...`);

  try {
    const response = await axios.get(url);
    const project = response.data;

    console.log(`Project: ${project.name}`);
    const file = project.files.find(
      (f: any) => f.name === "racbasicsampleproject.rvt",
    );

    if (file) {
      console.log(`File: ${file.name}`);
      console.log(`Status: ${file.status}`);
      console.log(`Progress: ${file.progress}`);
      console.log(`URN: ${file.apsUrn}`);
    } else {
      console.log("File not found in response.");
    }
  } catch (error: any) {
    console.error("Error fetching API:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.log("Server might not be running on port 8080.");
    }
  }
}

checkApiResponse();
