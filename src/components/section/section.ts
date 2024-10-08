export default class Section {
  title: string;

  constructor(title: string) {
    this.title = title;
  }

  getTitle() {
    return this.title;
  }
}
