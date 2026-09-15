# O CI roda "npm ci --production" dentro de src/ antes do terraform apply,
# então node_modules já está em disco quando este archive_file roda.
data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/dist/lambda.zip"
  excludes    = ["package-lock.json"]
}

resource "aws_lambda_function" "auth_cpf" {
  function_name = "${var.project_name}-auth-cpf"
  role          = var.lab_role_arn

  filename         = data.archive_file.lambda_package.output_path
  source_code_hash = data.archive_file.lambda_package.output_base64sha256

  handler = "index.handler"
  runtime = "nodejs20.x"
  timeout = 10
  memory_size = 256

  vpc_config {
    subnet_ids         = data.terraform_remote_state.cluster.outputs.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST             = data.terraform_remote_state.database.outputs.rds_address
      DB_PORT              = tostring(data.terraform_remote_state.database.outputs.rds_port)
      DB_NAME              = data.terraform_remote_state.database.outputs.db_name
      DB_USERNAME          = var.db_username
      DB_PASSWORD          = var.db_password
      CUSTOMER_JWT_SECRET  = var.customer_jwt_secret
      CUSTOMER_JWT_TTL     = tostring(var.customer_jwt_ttl_seconds)
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "auth_cpf" {
  name              = "/aws/lambda/${aws_lambda_function.auth_cpf.function_name}"
  retention_in_days = 7
}
