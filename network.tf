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

# Fase 4: a Lambda não acessa mais o RDS (consulta o os-service pelo
# endpoint interno). Ela continua na VPC só para sair pela NAT Gateway com
# IP fixo; o SG não precisa de regra de ingress.
