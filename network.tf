resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-auth-cpf-sg"
  description = "SG da Lambda de autenticacao por CPF"
  vpc_id      = data.terraform_remote_state.cluster.outputs.vpc_id

  # Sem regra de ingress: a Lambda não recebe conexões de rede diretamente,
  # só é invocada pelo próprio serviço Lambda via API Gateway.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Nota: o security group do RDS (repositório infra-database) já libera a
# porta 3306 para todo o CIDR da VPC, então a Lambda (que roda dentro da
# mesma VPC) já consegue conectar sem precisar de uma regra adicional aqui.
