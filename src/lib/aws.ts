import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

const cfg = {
  region: process.env.AWS_REGION!,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined, // falls back to IAM role in production
};

// Singleton instances (module-level cache works in Next.js edge/node)
export const cognitoClient = new CognitoIdentityProviderClient(cfg);

const dynamo = new DynamoDBClient(cfg);
export const db = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions: { removeUndefinedValues: true },
});

export const s3Client = new S3Client({ ...cfg, region: process.env.S3_REGION ?? cfg.region });

export const TABLE = process.env.DYNAMODB_TABLE!;
export const GSI_USER = process.env.DYNAMODB_GSI_USER!;
export const GSI_EMP = process.env.DYNAMODB_GSI_EMP!;
