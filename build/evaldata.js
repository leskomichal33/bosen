const fs=require('fs');
const h=fs.readFileSync(process.argv[2],'utf8');
const js=h.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
class DCLogic{constructor(p){this.props=p||{};this.state={}}setState(){}}
const Component=eval('('+js.replace('class Component','class')+')');
const c=new Component({});
const v=c.renderVals();
const clean=JSON.parse(JSON.stringify(v));
fs.writeFileSync(process.argv[3],JSON.stringify(clean,null,1));
console.log(Object.keys(clean));
