import {
  Ec2, Ebs, Elb, Nlb, Alb, Eip, Rds, ProviderResource, Response, GcpVm, GcpDisks, GcpSql, GcpLb, GcpEip
} from '@cloudchipr/cloudchipr-engine'
import { Output } from '../constants'
import { DateTimeHelper, NumberConvertHelper, SizeConvertHelper } from '../helpers'

export default class ResponseDecorator {
  decorate (cloudProvider: string, resources: Response<ProviderResource>[], output: string): any[] {
    resources = this[`${cloudProvider}RemoveEmptyResourcesAndSort`](resources)
    let data = []
    resources.forEach((resource: Response<ProviderResource>) => {
      data = [...data, ...this.eachItem(cloudProvider, resource, output)]
    })
    return data
  }

  decorateClean (resource: Response<ProviderResource>, requestedIds: string[], subcommand: string) {
    return this[`${subcommand}Clean`](resource, requestedIds)
  }

  decorateCleanFailure (ids: object) {
    const data = []
    for (const subCommand in ids) {
      ids[subCommand].forEach((id) => {
        data.push(this.clean(subCommand, id, false))
      })
    }
    return data
  }

  getIds (resource: Response<ProviderResource>, subcommand: string) {
    return this[`${subcommand}GetIds`](resource)
  }

  formatPrice (price?: number): string {
    if (price === undefined) {
      return 'N/A'
    }
    return '$' + price.toFixed(2)
  }

  sortByPriceSummary (data: any[]): any[] {
    return data.sort((a: any, b: any) => parseFloat(b['Cost Per Month'].slice(1)) - parseFloat(a['Cost Per Month'].slice(1)))
  }

  private awsRemoveEmptyResourcesAndSort (resources: Array<Response<ProviderResource>>): Response<ProviderResource>[] {
    return resources.reduce((accumulator: Array<Response<ProviderResource>>, pilot: Response<ProviderResource>) => {
      if (pilot.count > 0) {
        pilot.items.sort((a: ProviderResource, b: ProviderResource) => a.c8rAccount.localeCompare(b.c8rAccount) || b.pricePerMonth - a.pricePerMonth)
        accumulator.push(pilot)
      }
      return accumulator
    }, [])
  }

  private gcpRemoveEmptyResourcesAndSort (resources: Array<Response<ProviderResource>>): Response<ProviderResource>[] {
    return resources
  }

  private eachItem (cloudProvider: string, resource: Response<ProviderResource>, output: string) {
    switch (output) {
      case Output.DETAILED:
        return this.eachItemDetail(cloudProvider, resource)
      case Output.SUMMARIZED:
        return this.eachItemSummary(cloudProvider, resource)
    }
  }

  private eachItemDetail (cloudProvider:string, resource: Response<ProviderResource>) {
    return resource.items.map((item: ProviderResource) => this[`${cloudProvider}${item.constructor.name}`](item))
  }

  private eachItemSummary (cloudProvider:string, resource: Response<ProviderResource>) {
    const totalPrice = resource.items.map(o => o.pricePerMonth).reduce((a, b) => a !== undefined && b !== undefined ? a + b : 0, 0)
    return [
      {
        Service: resource.items[0].constructor.name.toUpperCase(),
        'Cost Per Month': this.formatPrice(totalPrice)
      }
    ]
  }

  private awsEc2 (ec2: Ec2) {
    return {
      'Instance ID': ec2.id,
      'Instance Type': ec2.type,
      [`CPU % (${ec2.cpu.Type})`]: NumberConvertHelper.toFixed(ec2.cpu.Value),
      [`NetIn (${ec2.networkIn.Type})`]: SizeConvertHelper.fromBytes(ec2.networkIn.Value),
      [`NetOut (${ec2.networkOut.Type})`]: SizeConvertHelper.fromBytes(ec2.networkOut.Value),
      'Price Per Month': this.formatPrice(ec2.pricePerMonth),
      Age: DateTimeHelper.convertToWeeksDaysHours(ec2.age),
      'Name Tag': ec2.nameTag,
      Region: ec2.getRegion(),
      Account: ec2.c8rAccount
    }
  }

  private ec2Clean (resource: Response<ProviderResource>, requestedIds: string[]) {
    let price: number = 0
    const succeededIds = resource.items.map((item: Ec2) => {
      price += item.pricePerMonth
      return item.id
    })
    const data = requestedIds.map((id: string) => this.clean('EC2', id, succeededIds.includes(id)))
    return {
      data: data,
      price: price
    }
  }

  private ec2GetIds (resource: Response<ProviderResource>) {
    return resource.items.map((item: Ec2) => item.id)
  }

  private awsEbs (ebs: Ebs) {
    return {
      'Volume ID': ebs.id,
      Type: ebs.type,
      State: ebs.state,
      Size: ebs.size,
      Age: DateTimeHelper.convertToWeeksDaysHours(ebs.age),
      'Price Per Month': this.formatPrice(ebs.pricePerMonth),
      'Name Tag': ebs.nameTag,
      Region: ebs.getRegion(),
      Account: ebs.c8rAccount
    }
  }

  private ebsClean (resource: Response<ProviderResource>, requestedIds: string[]) {
    let price: number = 0
    const succeededIds = resource.items.map((item: Ebs) => {
      price += item.pricePerMonth
      return item.id
    })
    const data = requestedIds.map((id: string) => this.clean('EBS', id, succeededIds.includes(id)))
    return {
      data: data,
      price: price
    }
  }

  private ebsGetIds (resource: Response<ProviderResource>) {
    return resource.items.map((item: Ebs) => item.id)
  }

  private awsRds (rds: Rds) {
    return {
      'DB ID': rds.id,
      'Instance Type': rds.instanceType,
      [`Database Connection (${rds.averageConnections.Type})`]: rds.averageConnections.Value,
      'Price Per Month': this.formatPrice(rds.pricePerMonth),
      'DB Type': rds.dbType,
      'Multi-AZ': rds.multiAZ ? 'Yes' : 'No',
      'Name Tag': rds.nameTag,
      Region: rds.getRegion(),
      Account: rds.c8rAccount
    }
  }

  private rdsClean (resource: Response<ProviderResource>, requestedIds: string[]) {
    let price: number = 0
    const succeededIds = resource.items.map((item: Rds) => {
      price += item.pricePerMonth
      return item.id
    })
    const data = requestedIds.map((id: string) => this.clean('RDS', id, succeededIds.includes(id)))
    return {
      data: data,
      price: price
    }
  }

  private rdsGetIds (resource: Response<ProviderResource>) {
    return resource.items.map((item: Rds) => item.id)
  }

  private awsEip (eip: Eip) {
    return {
      'IP Address': eip.ip,
      'Price Per Month': this.formatPrice(eip.pricePerMonth),
      'Name Tag': eip.nameTag,
      Region: eip.getRegion(),
      Account: eip.c8rAccount
    }
  }

  private eipClean (resource: Response<ProviderResource>, requestedIds: string[]) {
    let price: number = 0
    const succeededIds = resource.items.map((item: Eip) => {
      price += item.pricePerMonth
      return item.ip
    })
    const data = requestedIds.map((id: string) => this.clean('EIP', id, succeededIds.includes(id)))
    return {
      data: data,
      price: price
    }
  }

  private eipGetIds (resource: Response<ProviderResource>) {
    return resource.items.map((item: Eip) => item.ip)
  }

  private awsElb (elb: Elb) {
    return {
      'Load Balancer Name': elb.loadBalancerName,
      'DNS Name': elb.dnsName,
      Age: DateTimeHelper.convertToWeeksDaysHours(elb.age),
      'Price Per Month': this.formatPrice(elb.pricePerMonth),
      'Name Tag': elb.nameTag,
      Region: elb.getRegion(),
      Account: elb.c8rAccount
    }
  }

  private elbClean (resource: Response<ProviderResource>, requestedIds: string[]) {
    let price: number = 0
    const succeededIds = resource.items.map((item: Elb) => {
      price += item.pricePerMonth
      return item.loadBalancerName
    })
    const data = requestedIds.map((id: string) => this.clean('ELB', id, succeededIds.includes(id)))
    return {
      data: data,
      price: price
    }
  }

  private elbGetIds (resource: Response<ProviderResource>) {
    return resource.items.map((item: Elb) => item.loadBalancerName)
  }

  private awsNlb (nlb: Nlb) {
    return {
      'Load Balancer Name': nlb.loadBalancerName,
      'DNS Name': nlb.dnsName,
      Age: DateTimeHelper.convertToWeeksDaysHours(nlb.age),
      'Price Per Month': this.formatPrice(nlb.pricePerMonth),
      'Name Tag': nlb.nameTag,
      Region: nlb.getRegion(),
      Account: nlb.c8rAccount
    }
  }

  private nlbClean (resource: Response<ProviderResource>, requestedIds: string[]) {
    let price: number = 0
    const succeededIds = resource.items.map((item: Nlb) => {
      price += item.pricePerMonth
      return item.loadBalancerName
    })
    const data = requestedIds.map((id: string) => this.clean('Nlb', id, succeededIds.includes(id)))
    return {
      data: data,
      price: price
    }
  }

  private nlbGetIds (resource: Response<ProviderResource>) {
    return resource.items.map((item: Nlb) => item.loadBalancerName)
  }

  private awsAlb (alb: Alb) {
    return {
      'Load Balancer Name': alb.loadBalancerName,
      'DNS Name': alb.dnsName,
      Age: DateTimeHelper.convertToWeeksDaysHours(alb.age),
      'Price Per Month': this.formatPrice(alb.pricePerMonth),
      'Name Tag': alb.nameTag,
      Region: alb.getRegion(),
      Account: alb.c8rAccount
    }
  }

  private albClean (resource: Response<ProviderResource>, requestedIds: string[]) {
    let price: number = 0
    const succeededIds = resource.items.map((item: Alb) => {
      price += item.pricePerMonth
      return item.loadBalancerName
    })
    const data = requestedIds.map((id: string) => this.clean('Alb', id, succeededIds.includes(id)))
    return {
      data: data,
      price: price
    }
  }

  private albGetIds (resource: Response<ProviderResource>) {
    return resource.items.map((item: Alb) => item.loadBalancerName)
  }

  private gcpVm (vm: GcpVm) {
    return {
      'Instance Name': vm.name,
      'Machine Type': vm.machineType,
      'CPU % (MAX)': 'N/A',
      'NetIn (SUM)': 'N/A',
      'NetOut (SUM)': 'N/A',
      'Price Per Month': this.formatPrice(vm.pricePerMonth),
      Age: DateTimeHelper.convertToWeeksDaysHours(vm.age),
      Labels: vm.labels.map((label) => `${label.key}:${label.value}`).join(', '),
      Zone: vm.zone,
      Project: 'N/A'
    }
  }

  private gcpDisks (disks: GcpDisks) {
    return {
      'Disk Name': disks.name,
      Type: disks.type,
      Status: disks.status,
      Size: SizeConvertHelper.fromBytes(disks.size),
      Age: DateTimeHelper.convertToWeeksDaysHours(disks.age),
      'Price Per Month': this.formatPrice(disks.pricePerMonth),
      Labels: disks.labels.map((label) => `${label.key}:${label.value}`).join(', '),
      Zone: disks.zone,
      Project: 'N/A'
    }
  }

  private gcpSql (sql: GcpSql) {
    return {
      'Instance ID': sql.id,
      'DB Type': sql.type,
      'DB Connection (MAX)': 'N/A',
      'Price Per Month': this.formatPrice(sql.pricePerMonth),
      'Multi-AZ': sql.multiAz ? 'Yes' : 'No',
      Labels: sql.labels.map((label) => `${label.key}:${label.value}`).join(', '),
      Region: sql.region,
      Project: sql.project
    }
  }

  private gcpLb (lb: GcpLb) {
    return {
      'Load Balancer Name': lb.name,
      Type: lb.type,
      Scope: lb.scope ?? 'N/A',
      Age: DateTimeHelper.convertToWeeksDaysHours(lb.age),
      'Price Per Month': this.formatPrice(lb.pricePerMonth),
      Labels: lb.labels.map((label) => `${label.key}:${label.value}`).join(', '),
      Region: lb.region ?? '',
      Project: 'N/A'
    }
  }

  private gcpEip (eip: GcpEip) {
    return {
      'IP Address': eip.ip,
      Name: eip.name,
      'Price Per Month': this.formatPrice(eip.pricePerMonth),
      Labels: eip.labels.map((label) => `${label.key}:${label.value}`).join(', '),
      Region: eip.region ?? '',
      Project: 'N/A'
    }
  }

  private clean (subcommand: string, id: string, success: boolean) {
    return {
      subcommand: subcommand,
      id: id,
      success: success
    }
  }
}
