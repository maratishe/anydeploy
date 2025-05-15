# anydeploy

deploy anything to a docker container on a publically accessible IP over SSH

## requirements
 - public/reachable IP (VM, etc.)
 - SSH (22) + another port for the app
 - docker
 - username (sudoer)
 - username's RSA

↑↑↑↑↑ all achievable fully automatically in Terraform (see below) on AWS/AZ/GCP/... ↑↑↑↑↑↑

## steps
 - create VM
   - if terraform + full automation, see below
 - encode RSA using your own secret password
   - `openssl enc -aes-256-cbc -salt -in YOUR_RSA_FILE -out RSA.enc`
   - **not id.pub** (public) but **private** key!
   - put `RSA.enc` into the root directory of the repo -- I have mine there but you cannot read or use it ;)
 - put whaterver you want into `app`, this app will be deployed as a container
   - I only have a simple **I am here** html output
 - create your own github repo, put this code into it and run its **Github Actions** script
   - all the necessary into is entered via the form in the actions script (no secrets, variables, etc)


## full auto


### RSA + VM on AWS

```
resource "tls_private_key" "ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "default" {
  key_name   = "${local.prefix}-keypair"
  public_key = tls_private_key.ssh_key.public_key_openssh
}

resource "aws_instance" "default" {
  ami                         = "ami-0599b6e53ca798bb2" # old "ami-e99f4896" # this is "amazon linux"
  instance_type               = "t3.xlarge" # "t2.medium"
  availability_zone           = "ap-northeast-1a"
  associate_public_ip_address = true
  key_name                    = aws_key_pair.default.key_name
  vpc_security_group_ids      = [aws_security_group.ssh.id]

  root_block_device {
    volume_type           = "standard"
    volume_size           = 100
    delete_on_termination = true
  }
  
  # this script will run at initiation
  user_data = <<EOF
#!/bin/bash

dnf update -y && dnf clean all
dnf install -y vim zip unzip git
dnf install -y openssh-server openssh-clients
yum install -y yum-utils

# python 3.11
dnf install -y python3.11
dnf install -y python3.11-pip

# php
dnf install -y php php-devel php-mbstring php-pdo php-xml php-gd php-fpm php-mysqlnd php-opcache
echo "error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT & ~E_NOTICE & ~E_COMPILE_WARNING & ~E_WARNING" >> /etc/php.ini

# docker 
dnf install -y docker
systemctl enable docker
systemctl start docker

# terraform
#yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
#yum -y install terraform

# AWS CLIのインストール
#curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
#unzip awscliv2.zip
#./aws/install

mkdir /add
chmod -R 777 /add

EOF

  tags = {
    Name = "${local.prefix}-ec2"
  }
}

````




### RSA + VM on Azure

```

# security group, resource group and all the other necessary TF resources

resource "tls_private_key" "myssh" {
  algorithm = "RSA"
  rsa_bits = 4096
}

resource "azurerm_linux_virtual_machine" "vm" {
  name                = "${local.rg_name}-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location              = azurerm_resource_group.rg.location
  # "Standard_DS1_v2"
  # Standard_DS2_v2 vCPUs: 2 RAM: 7 GB Temporary Storage: 14 GB
  # Standard_DS3_v2 vCPUs: 4 RAM: 14 GB Temporary Storage: 28 GB
  # Standard_DS4_v2 vCPUs: 8 RAM: 28 GB Temporary Storage: 56 GB
  # Standard_DS5_v2 vCPUs: 16 RAM: 56 GB Temporary Storage: 112 GB
  # Standard_D8s_v3 vCPUs: 8 RAM: 32 GB Temporary Storage: 64 GB
  # Standard_D16s_v3 vCPUs: 16 RAM: 64 GB Temporary Storage: 128 GB
  # Standard_D32s_v3 vCPUs: 32 RAM: 128 GB Temporary Storage: 256 GB
  # Standard_D64s_v3 vCPUs: 64 RAM: 256 GB Temporary Storage: 512 GB
  size                = "Standard_DS3_v2"
  admin_username = "USERNAME"  ←←← replace with your own
  network_interface_ids = [ azurerm_network_interface.nics.id ]

  admin_ssh_key {
    username       = "USERNAME"   ←←← replace with your own, same is OK
    public_key     = tls_private_key.myssh.public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    # Standard_GRS Geo-redundant storage
    # Standard_RAGRS Read-access geo-redundant storage
    # Standard_ZRS Zone-redundant storage
    # Premium_LRS Locally-redundant storage with SSD
    # Premium_ZRS Zone-redundant storage with SSD
    storage_account_type = "Standard_LRS"
  }
  
  source_image_reference {
    publisher = "OpenLogic"
    offer     = "CentOS"
    sku       = "7.7"
    version   = "latest"
  }
  
  # this script will run at initiation, it us to install docker, filesystem, etc.
  custom_data = base64encode(file("user-data.sh"))
}

resource "azurerm_network_interface" "nics" {
  name                = "${local.rg_name}-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "${local.rg_name}-nic-ipconfig"
    subnet_id                     = azurerm_subnet.subnet.id
    private_ip_address_allocation = "Static"  # statis IP address!
    public_ip_address_id          = azurerm_public_ip.public_ip.id
  }
}

# Associate specific ports security group with network interface
resource "azurerm_network_interface_security_group_association" "assoc_specific_ports" {
  network_interface_id      = azurerm_network_interface.nics.id
  network_security_group_id = azurerm_network_security_group.nsg_specific_ports.id
}

```