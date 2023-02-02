from api import app


@app.route('/')
def hello():
    return f'Hello, World! 10 plus 10 is: {add10(10)}'


def add10(x):
    return x + 10
