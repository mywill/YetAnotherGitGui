import semanticRelease from 'semantic-release';
import { appendFileSync } from 'fs';

async function run() {
  try {
    const result = await semanticRelease();

    const outputFile = process.env.GITHUB_OUTPUT;

    if (result && result.nextRelease) {
      appendFileSync(outputFile, `new_release_published=true\n`);
      appendFileSync(outputFile, `new_release_version=${result.nextRelease.version}\n`);
      console.log(`Released version ${result.nextRelease.version}`);
    } else {
      appendFileSync(outputFile, `new_release_published=false\n`);
      console.log('No release published');
    }
  } catch (error) {
    console.error('Semantic release failed:', error);
    process.exit(1);
  }
}

run();
