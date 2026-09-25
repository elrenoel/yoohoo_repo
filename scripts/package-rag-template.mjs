import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const imageArgument = process.argv.find((argument) => argument.startsWith("--image-uri="));
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));

if (!imageArgument) {
  throw new Error("Usage: npm run rag:package -- --image-uri=<ECR repository URI@sha256:digest>");
}

const imageUri = imageArgument.slice("--image-uri=".length);
if (!/^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(imageUri)) {
  throw new Error("Image URI must be an immutable ECR digest URI");
}

const outputPath = resolve(
  outputArgument?.slice("--output=".length) || "build/rag-packaged-template.json",
);
const template = JSON.parse(await readFile("infra/rag/template.json", "utf8"));
const stateMachine = JSON.parse(await readFile("infra/rag/state-machine.asl.json", "utf8"));

for (const resource of Object.values(template.Resources)) {
  if (resource.Type !== "AWS::Serverless::Function" || resource.Properties?.PackageType !== "Image") {
    continue;
  }

  resource.Properties.ImageUri = imageUri;
  if (resource.Metadata) {
    delete resource.Metadata.DockerContext;
    delete resource.Metadata.Dockerfile;
    delete resource.Metadata.DockerTag;
  }
}

const workflow = template.Resources.StateMachine;
if (!workflow || workflow.Type !== "AWS::Serverless::StateMachine") {
  throw new Error("StateMachine resource is missing from the RAG template");
}

workflow.Properties.Definition = stateMachine;
delete workflow.Properties.DefinitionUri;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
console.log(`Packaged RAG template written to ${outputPath}`);
