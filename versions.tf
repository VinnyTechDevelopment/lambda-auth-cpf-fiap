terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # preencher via -backend-config no terraform init (bucket, key, region, dynamodb_table)
  }
}

provider "aws" {
  region = var.aws_region
}
